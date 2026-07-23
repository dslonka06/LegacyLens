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

  async runAll(workspaceId: string, model: KnowledgeModel, generation: number): Promise<void> {
    console.log('[LLMSummary] runAll start', { workspaceId, generation, isElectron: this.electron.isElectron, hasAi: !!model.ai });

    if (!this.electron.isElectron) {
      console.log('[LLMSummary] early exit: not electron');
      return;
    }

    const ai = model.ai;
    if (!ai) {
      console.log('[LLMSummary] early exit: model.ai is null/undefined');
      return;
    }

    console.log('[LLMSummary] ai keys present:', Object.keys(ai));

    let providerUrl: string | null = null;
    try {
      providerUrl = await this.electron.getAiProviderUrl();
      console.log('[LLMSummary] providerUrl=', providerUrl);
    } catch (err) {
      console.error('[LLMSummary] getAiProviderUrl threw:', err);
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'failed to read provider url');
      return;
    }

    if (!providerUrl) {
      console.log('[LLMSummary] early exit: no provider url configured — marking no-provider');
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'no-provider');
      return;
    }

    console.log('[LLMSummary] building prompts...');
    this.manager.setStageRunning(workspaceId, 'prompt');

    const tasks: Array<{ key: LLMSummaryKey; prompt: string }> = [];

    try {
      const scope = model.targetType;
      const workspaceName = model.workspaceName ?? 'Unknown';
      const languages = model.structure.languages ?? [];
      const technologies = model.structure.technologies?.map(t => t.technology) ?? [];
      const totalFiles = model.structure.totalFiles ?? 0;
      const structuralPatterns = model.relationships.architecture?.patterns ?? [];

      console.log('[LLMSummary] prompt context:', { scope, workspaceName, totalFiles, languages, technologies });

      if (ai.understanding) {
        console.log('[LLMSummary] building prompt: understanding');
        tasks.push({
          key: 'understanding',
          prompt: this.understandingPrompt.build({
            workspaceName, scope, understanding: ai.understanding,
            architecture: ai.architecture ?? null, repositoryContext: null,
            totalFiles, languages, technologies,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: understanding (ai.understanding is falsy)');
      }

      if (ai.security) {
        console.log('[LLMSummary] building prompt: security');
        tasks.push({
          key: 'security',
          prompt: this.securityPrompt.build({
            workspaceName, scope, languages, technologies,
            architecturePatterns: structuralPatterns.map(p => p.name),
            security: ai.security, architecture: ai.architecture ?? null,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: security (ai.security is falsy)');
      }

      if (ai.recommendations) {
        console.log('[LLMSummary] building prompt: recommendations');
        tasks.push({
          key: 'recommendations',
          prompt: this.recommendationsPrompt.build({
            workspaceName, scope, recommendations: ai.recommendations,
            architecture: ai.architecture ?? null, totalFiles, languages,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: recommendations (ai.recommendations is falsy)');
      }

      if (ai.learningPath) {
        console.log('[LLMSummary] building prompt: learningPath');
        tasks.push({
          key: 'learningPath',
          prompt: this.learningPathPrompt.build({
            workspaceName, scope, learningPath: ai.learningPath,
            understanding: ai.understanding ?? null, totalFiles, languages,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: learningPath (ai.learningPath is falsy)');
      }

      if (ai.architecture) {
        console.log('[LLMSummary] building prompt: architecture');
        tasks.push({
          key: 'architecture',
          prompt: this.architecturePrompt.build({
            workspaceName, scope, architecture: ai.architecture,
            structuralPatterns, totalFiles, languages, technologies,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: architecture (ai.architecture is falsy)');
      }

      if (ai.dataFlow) {
        console.log('[LLMSummary] building prompt: dataFlow');
        tasks.push({
          key: 'dataFlow',
          prompt: this.dataFlowPrompt.build({
            workspaceName, scope, dataFlow: ai.dataFlow,
            architecture: ai.architecture ?? null, totalFiles, languages,
          }),
        });
      } else {
        console.log('[LLMSummary] skipping prompt: dataFlow (ai.dataFlow is falsy)');
      }

      console.log(`[LLMSummary] prompt build complete — ${tasks.length} tasks:`, tasks.map(t => t.key));
    } catch (err) {
      console.error('[LLMSummary] error during prompt building:', err);
    } finally {
      this.manager.clearStageRunning(workspaceId, 'prompt');
    }

    if (tasks.length === 0) {
      console.log('[LLMSummary] early exit: no tasks built (all ai fields were falsy)');
      return;
    }

    console.log(`[LLMSummary] starting generate stage for ${tasks.length} tasks`);
    this.manager.setStageRunning(workspaceId, 'generate');

    try {
      const results = await Promise.all(
        tasks.map(task => this._generateAndMerge(workspaceId, model, generation, task.key, task.prompt)),
      );

      console.log('[LLMSummary] all generate calls settled:', results.map((ok, i) => `${tasks[i].key}=${ok}`));

      const anyFailed  = results.some(ok => !ok);
      const anySuccess = results.some(ok => ok);

      if (!anySuccess) {
        console.error('[LLMSummary] generate stage: ALL tasks failed');
        this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'All summary generations failed');
      } else if (anyFailed) {
        console.warn('[LLMSummary] generate stage: partial success');
        this.manager.markAIStagePartial(workspaceId, 'generate', generation);
      } else {
        console.log('[LLMSummary] generate stage: all tasks succeeded');
        this.manager.mergeAIResults(workspaceId, {}, 'generate', generation);
      }
    } catch (err) {
      console.error('[LLMSummary] unexpected error in Promise.all:', err);
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'Unexpected error during generate stage');
    } finally {
      this.manager.clearStageRunning(workspaceId, 'generate');
    }
  }

  private async _generateAndMerge(
    workspaceId: string,
    model: KnowledgeModel,
    generation: number,
    key: LLMSummaryKey,
    prompt: string,
  ): Promise<boolean> {
    console.log(`[LLMSummary] _generateAndMerge start key=${key} promptLength=${prompt.length}`);
    try {
      console.log(`[LLMSummary] calling aiExplain key=${key}`);
      const text = await this._withTimeout(
        this.electron.aiExplain(prompt),
        LLM_TIMEOUT_MS,
        key,
      );

      console.log(`[LLMSummary] aiExplain returned key=${key} text=${text === null ? 'NULL' : text === undefined ? 'UNDEFINED' : `string(${(text as string).length})`}`);

      if (text === null || text === undefined) {
        console.warn(`[LLMSummary] key=${key} returned null/undefined — skipping merge`);
        return false;
      }

      console.log(`[LLMSummary] merging key=${key}`);
      this.manager.mergeSummaryKey(workspaceId, key, text, generation);
      console.log(`[LLMSummary] merge complete key=${key}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLMSummary] FAILED key=${key}`, message, err);
      return false;
    }
  }

  private _withTimeout<T>(promise: Promise<T>, ms: number, key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => {
          console.error(`[LLMSummary] TIMEOUT key=${key} after ${ms}ms`);
          reject(new Error(`LLM generate timed out after ${ms}ms for summary key=${key}`));
        },
        ms,
      );
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });
  }
}
