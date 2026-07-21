import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';
import type { LLMSummaryKey } from '@app/knowledge/models/llm-summaries.model';
import { RepositoryExplanationPromptBuilder } from '@app/ai/prompts/repository-explanation-prompt';
import { SecurityOverviewPromptBuilder } from '@app/ai/prompts/security-overview-prompt';
import { RecommendationSummaryPromptBuilder } from '@app/ai/prompts/recommendation-summary-prompt';
import { LearningPathSummaryPromptBuilder } from '@app/ai/prompts/learning-path-summary-prompt';
import { ArchitectureSummaryPromptBuilder } from '@app/ai/prompts/architecture-summary-prompt';
import { DataFlowSummaryPromptBuilder } from '@app/ai/prompts/data-flow-summary-prompt';

const LLM_TIMEOUT_MS = 120_000;

/**
 * LLMSummaryService — owns the Prompt and Generate pipeline stages.
 *
 * After all Derive stages complete, AIAnalysisService calls runAll() here.
 * This service builds one prompt per page, calls the LLM for each in parallel,
 * and merges each generated narrative into model.ai.summaries as it arrives.
 *
 * If the LLM provider is not configured (aiExplain returns null), the stage
 * is skipped silently — no summary is stored and no fallback text is shown.
 */
@Injectable({ providedIn: 'root' })
export class LLMSummaryService {
  constructor(
    private readonly electron: ElectronService,
    private readonly manager: WorkspaceManagerService,
    private readonly understandingPrompt: RepositoryExplanationPromptBuilder,
    private readonly securityPrompt: SecurityOverviewPromptBuilder,
    private readonly recommendationsPrompt: RecommendationSummaryPromptBuilder,
    private readonly learningPathPrompt: LearningPathSummaryPromptBuilder,
    private readonly architecturePrompt: ArchitectureSummaryPromptBuilder,
    private readonly dataFlowPrompt: DataFlowSummaryPromptBuilder,
  ) {}

  /**
   * Build all applicable LLM prompts and generate narrative summaries.
   * Runs all applicable summaries concurrently. Each result is merged into
   * the workspace as it arrives — the UI updates progressively.
   *
   * If no provider URL has been configured by the user, the generate stage is
   * skipped and the workspace is marked with a 'generate' failure so pages can
   * show the "configure a provider" empty state instead of hiding the card.
   */
  async runAll(workspaceId: string, model: KnowledgeModel, generation: number): Promise<void> {
    if (!this.electron.isElectron) return;

    const ai = model.ai;
    if (!ai) return;

    // Check that the user has explicitly configured a provider URL before spending
    // time building prompts. getAiProviderUrl() returns null when no URL is stored.
    const providerUrl = await this.electron.getAiProviderUrl();
    if (!providerUrl) {
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'no-provider');
      return;
    }

    // Mark prompt stage running — all prompt builds happen synchronously before any LLM call
    this.manager.setStageRunning(workspaceId, 'prompt');

    const tasks: Array<{ key: LLMSummaryKey; prompt: string }> = [];

    try {
      const scope = model.targetType;
      const workspaceName = model.workspaceName ?? 'Unknown';
      const languages = model.structure.languages ?? [];
      const technologies = model.structure.technologies?.map(t => t.technology) ?? [];
      const totalFiles = model.structure.totalFiles ?? 0;
      const structuralPatterns = model.relationships.architecture?.patterns ?? [];

      if (ai.understanding) {
        tasks.push({
          key: 'understanding',
          prompt: this.understandingPrompt.build({
            workspaceName,
            scope,
            understanding: ai.understanding,
            architecture: ai.architecture ?? null,
            repositoryContext: null,
            totalFiles,
            languages,
            technologies,
          }),
        });
      }

      if (ai.security) {
        tasks.push({
          key: 'security',
          prompt: this.securityPrompt.build({
            workspaceName,
            scope,
            languages,
            technologies,
            architecturePatterns: structuralPatterns.map(p => p.name),
            security: ai.security,
            architecture: ai.architecture ?? null,
          }),
        });
      }

      if (ai.recommendations) {
        tasks.push({
          key: 'recommendations',
          prompt: this.recommendationsPrompt.build({
            workspaceName,
            scope,
            recommendations: ai.recommendations,
            architecture: ai.architecture ?? null,
            totalFiles,
            languages,
          }),
        });
      }

      if (ai.learningPath) {
        tasks.push({
          key: 'learningPath',
          prompt: this.learningPathPrompt.build({
            workspaceName,
            scope,
            learningPath: ai.learningPath,
            understanding: ai.understanding ?? null,
            totalFiles,
            languages,
          }),
        });
      }

      if (ai.architecture) {
        tasks.push({
          key: 'architecture',
          prompt: this.architecturePrompt.build({
            workspaceName,
            scope,
            architecture: ai.architecture,
            structuralPatterns,
            totalFiles,
            languages,
            technologies,
          }),
        });
      }

      if (ai.dataFlow) {
        tasks.push({
          key: 'dataFlow',
          prompt: this.dataFlowPrompt.build({
            workspaceName,
            scope,
            dataFlow: ai.dataFlow,
            architecture: ai.architecture ?? null,
            totalFiles,
            languages,
          }),
        });
      }
    } finally {
      this.manager.clearStageRunning(workspaceId, 'prompt');
    }

    if (tasks.length === 0) return;

    // Mark generate stage running for the full parallel batch
    this.manager.setStageRunning(workspaceId, 'generate');

    try {
      const results = await Promise.all(
        tasks.map(task => this._generateAndMerge(workspaceId, model, generation, task.key, task.prompt)),
      );

      // results[i] is true if the key was generated successfully, false if it failed.
      const anyFailed  = results.some(ok => !ok);
      const anySuccess = results.some(ok => ok);

      if (!anySuccess) {
        // Every call failed — mark generate as failed
        this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'All summary generations failed');
      } else if (anyFailed) {
        // Partial success — some keys have summaries, some do not
        this.manager.markAIStagePartial(workspaceId, 'generate', generation);
      } else {
        // All keys succeeded
        this.manager.mergeAIResults(workspaceId, {}, 'generate', generation);
      }
    } catch {
      // Individual failures are handled inside _generateAndMerge — this guard
      // handles unexpected Promise.all-level errors only.
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'Unexpected error during generate stage');
    } finally {
      this.manager.clearStageRunning(workspaceId, 'generate');
    }
  }

  /**
   * Returns true if the key was stored successfully, false if the call failed.
   */
  private async _generateAndMerge(
    workspaceId: string,
    model: KnowledgeModel,
    generation: number,
    key: LLMSummaryKey,
    prompt: string,
  ): Promise<boolean> {
    try {
      const text = await this._withTimeout(
        this.electron.aiExplain(prompt),
        LLM_TIMEOUT_MS,
        key,
      );

      if (text === null || text === undefined) {
        return false;
      }

      // Use mergeSummaryKey which reads and writes atomically in a single patch(),
      // preventing concurrent calls from overwriting each other's key.
      this.manager.mergeSummaryKey(workspaceId, key, text, generation);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLMSummary] FAILED key=${key}`, message);
      return false;
    }
  }

  private _withTimeout<T>(promise: Promise<T>, ms: number, key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`LLM generate timed out after ${ms}ms for summary key=${key}`)),
        ms,
      );
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });
  }
}
