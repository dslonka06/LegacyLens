import { Injectable, NgZone } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';
import type { LLMSummaryKey, LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { RepositoryExplanationPromptBuilder } from '@app/ai/prompts/repository-explanation-prompt';
import { RecommendationSummaryPromptBuilder } from '@app/ai/prompts/recommendation-summary-prompt';
import { LearningPathSummaryPromptBuilder } from '@app/ai/prompts/learning-path-summary-prompt';
import { ArchitectureSummaryPromptBuilder } from '@app/ai/prompts/architecture-summary-prompt';
import { DataFlowSummaryPromptBuilder } from '@app/ai/prompts/data-flow-summary-prompt';
import { SecurityFindingsPromptBuilder } from '@app/ai/prompts/security-findings-prompt';
import { SecurityVerificationBuilder } from '@app/ai/prompts/security-verification-builder';

const SECURITY_MAX_TOKENS = 4096;

const LLM_TIMEOUT_MS = 300_000;

@Injectable({ providedIn: 'root' })
export class LLMSummaryService {
  constructor(
    private readonly electron: ElectronService,
    private readonly manager: WorkspaceManagerService,
    private readonly ngZone: NgZone,
    private readonly understandingPrompt: RepositoryExplanationPromptBuilder,
    private readonly recommendationsPrompt: RecommendationSummaryPromptBuilder,
    private readonly learningPathPrompt: LearningPathSummaryPromptBuilder,
    private readonly architecturePrompt: ArchitectureSummaryPromptBuilder,
    private readonly dataFlowPrompt: DataFlowSummaryPromptBuilder,
    private readonly securityFindingsPrompt: SecurityFindingsPromptBuilder,
    private readonly securityVerification: SecurityVerificationBuilder,
  ) {}

  async runAll(workspaceId: string, model: KnowledgeModel, generation: number): Promise<void> {
    console.log('[LLMSummary] runAll start', { workspaceId, generation });

    if (!this.electron.isElectron) return;
    if (!model.ai) return;

    let provider = 'unknown';
    let modelId = 'unknown';
    let isLocal = false;

    try {
      const providers = await this.electron.aiGetProviders();
      const active = providers.find(p => p.active && p.configured);
      if (!active) {
        console.log('[LLMSummary] early exit: no provider configured');
        this.ngZone.run(() => this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'no-provider'));
        return;
      }
      provider = active.id;
      isLocal = active.category === 'local';
    } catch (err) {
      console.error('[LLMSummary] aiGetProviders threw:', err);
      this.ngZone.run(() => this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'failed to read provider status'));
      return;
    }

    try {
      modelId = (await this.electron.getAllSettings())['aiModel'] as string ?? 'unknown';
    } catch { /* non-fatal — provenance still records provider */ }

    this.ngZone.run(() => this.manager.setStageRunning(workspaceId, 'prompt'));
    let tasks: Array<{ key: LLMSummaryKey; prompt: string }>;
    try {
      tasks = this._buildTasks(model);
    } catch (err) {
      this.ngZone.run(() => {
        this.manager.markAIStageFailed(workspaceId, 'prompt', generation, 'Prompt building threw unexpectedly');
        this.manager.clearStageRunning(workspaceId, 'prompt');
      });
      return;
    }

    if (tasks.length === 0) {
      this.ngZone.run(() => {
        this.manager.markAIStageFailed(workspaceId, 'prompt', generation, 'No prompts could be built');
        this.manager.clearStageRunning(workspaceId, 'prompt');
      });
      return;
    }

    this.ngZone.run(() => {
      this.manager.mergeAIResults(workspaceId, {}, 'prompt', generation);
      this.manager.clearStageRunning(workspaceId, 'prompt');
    });

    console.log(`[LLMSummary] generating ${tasks.length} summaries with ${provider}/${modelId} (${isLocal ? 'sequential' : 'parallel'})`);
    this.ngZone.run(() => this.manager.setStageRunning(workspaceId, 'generate'));

    try {
      let results: boolean[];
      if (isLocal) {
        results = [];
        // Security runs first — its result populates findings before other summaries fire
        results.push(await this._generateSecurityAndMerge(workspaceId, model, generation, provider, modelId));
        for (const task of tasks) {
          results.push(await this._generateAndMerge(workspaceId, model, generation, task.key, task.prompt, provider, modelId));
        }
      } else {
        results = await Promise.all([
          this._generateSecurityAndMerge(workspaceId, model, generation, provider, modelId),
          ...tasks.map(task =>
            this._generateAndMerge(workspaceId, model, generation, task.key, task.prompt, provider, modelId),
          ),
        ]);
      }

      const anyFailed  = results.some(ok => !ok);
      const anySuccess = results.some(ok => ok);

      this.ngZone.run(() => {
        if (!anySuccess) {
          this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'All summary generations failed');
        } else if (anyFailed) {
          this.manager.markAIStagePartial(workspaceId, 'generate', generation);
        } else {
          this.manager.mergeAIResults(workspaceId, {}, 'generate', generation);
        }
      });
    } catch (err) {
      console.error('[LLMSummary] unexpected error in Promise.all:', err);
      this.ngZone.run(() => this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'Unexpected error during generate stage'));
    } finally {
      this.ngZone.run(() => this.manager.clearStageRunning(workspaceId, 'generate'));
    }
  }

  /**
   * Re-generate a single summary key without re-running the full pipeline.
   * Reads the freshest KnowledgeModel from the manager so the prompt is current.
   */
  async regenerate(workspaceId: string, key: LLMSummaryKey): Promise<void> {
    const ws = this.manager.getById(workspaceId);
    const model = ws?.knowledgeModel;
    if (!model?.ai) {
      console.warn(`[LLMSummary] regenerate skipped — no model for ws=${workspaceId}`);
      return;
    }

    let provider = 'unknown';
    let modelId = 'unknown';

    try {
      const providers = await this.electron.aiGetProviders();
      const active = providers.find(p => p.active && p.configured);
      if (!active) {
        console.warn('[LLMSummary] regenerate aborted: no provider configured');
        return;
      }
      provider = active.id;
    } catch (err) {
      console.error('[LLMSummary] regenerate: aiGetProviders threw:', err);
      return;
    }

    try {
      modelId = (await this.electron.getAllSettings())['aiModel'] as string ?? 'unknown';
    } catch { /* non-fatal */ }

    const generation = this.manager.getGeneration(workspaceId);
    this.ngZone.run(() => this.manager.setStageRunning(workspaceId, 'generate'));
    try {
      if (key === 'security') {
        await this._generateSecurityAndMerge(workspaceId, model, generation, provider, modelId);
      } else {
        const tasks = this._buildTasks(model).filter(t => t.key === key);
        if (tasks.length === 0) {
          console.warn(`[LLMSummary] regenerate: could not build prompt for key=${key}`);
          return;
        }
        await this._generateAndMerge(workspaceId, model, generation, key, tasks[0].prompt, provider, modelId);
      }
    } finally {
      this.ngZone.run(() => this.manager.clearStageRunning(workspaceId, 'generate'));
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildTasks(model: KnowledgeModel): Array<{ key: LLMSummaryKey; prompt: string }> {
    const ai = model.ai!;
    const tasks: Array<{ key: LLMSummaryKey; prompt: string }> = [];
    const scope = model.targetType;
    const workspaceName = model.workspaceName ?? 'Unknown';
    const languages = model.structure.languages ?? [];
    const technologies = model.structure.technologies?.map(t => t.technology) ?? [];
    const totalFiles = model.structure.totalFiles ?? 0;
    const structuralPatterns = model.relationships.architecture?.patterns ?? [];

    try {
      if (ai.understanding) tasks.push({ key: 'understanding', prompt: this.understandingPrompt.build({ workspaceName, scope, understanding: ai.understanding, architecture: ai.architecture ?? null, repositoryContext: null, totalFiles, languages, technologies }) });
      // security key is handled by _generateSecurityAndMerge — excluded from standard task list
      if (ai.recommendations) tasks.push({ key: 'recommendations', prompt: this.recommendationsPrompt.build({ workspaceName, scope, recommendations: ai.recommendations, architecture: ai.architecture ?? null, totalFiles, languages }) });
      if (ai.learningPath)  tasks.push({ key: 'learningPath', prompt: this.learningPathPrompt.build({ workspaceName, scope, learningPath: ai.learningPath, understanding: ai.understanding ?? null, totalFiles, languages }) });
      if (ai.architecture)  tasks.push({ key: 'architecture', prompt: this.architecturePrompt.build({ workspaceName, scope, architecture: ai.architecture, structuralPatterns, totalFiles, languages, technologies }) });
      if (ai.dataFlow)      tasks.push({ key: 'dataFlow', prompt: this.dataFlowPrompt.build({ workspaceName, scope, dataFlow: ai.dataFlow, architecture: ai.architecture ?? null, totalFiles, languages }) });
    } catch (err) {
      console.error('[LLMSummary] error during prompt building:', err);
    }

    return tasks;
  }

  private async _generateSecurityAndMerge(
    workspaceId: string,
    model: KnowledgeModel,
    generation: number,
    provider: string,
    modelId: string,
  ): Promise<boolean> {
    const evidence = model.ai?.security?.evidence;
    if (!evidence) {
      console.log('[LLMSummary] security: no evidence — skipping');
      return false;
    }

    // Heuristic verification checks are always derived from domain evidence — no LLM needed
    const verificationChecks = this.securityVerification.build(evidence);

    const generatedAt = new Date().toISOString();

    // Skip the LLM entirely when there are no candidate findings to confirm
    if (evidence.candidates.length === 0) {
      console.log('[LLMSummary] security: no candidates — synthesising no-findings result');
      const hasMeaningful = this.securityVerification.hasMeaningfulEvidence(evidence);
      const postureSummary = hasMeaningful
        ? 'No high-confidence security issues were detected. Domain evidence suggests baseline security controls are in place.'
        : 'No security-relevant patterns were detected in the analysed scope.';
      this.ngZone.run(() => {
        this.manager.mergeAIResults(workspaceId, {
          security: {
            ...model.ai!.security!,
            findings: [],
            verificationChecks,
            overallRisk: 'low',
            securityMaturity: 'Medium',
          },
        }, 'generate', generation);
        const entry: LLMSummaryEntry = { content: postureSummary, status: 'complete', provider, model: modelId, generatedAt };
        this.manager.mergeSummaryKey(workspaceId, 'security', entry, generation);
      });
      return true;
    }

    const prompt = this.securityFindingsPrompt.build({
      workspaceName: model.workspaceName ?? 'Unknown',
      scope: model.targetType,
      languages: model.structure?.languages ?? [],
      evidence,
    });

    try {
      const raw = await this._withTimeout(
        this.electron.aiExplain(prompt, SECURITY_MAX_TOKENS),
        LLM_TIMEOUT_MS,
        'security',
      );

      if (raw === null || raw === undefined) {
        const entry: LLMSummaryEntry = { content: '', status: 'failed', provider, model: modelId, generatedAt, error: 'No response received' };
        this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, 'security', entry, generation));
        return false;
      }

      const parsed = this.securityFindingsPrompt.parse(raw);

      if (parsed) {
        this.ngZone.run(() => {
          this.manager.mergeAIResults(workspaceId, {
            security: {
              ...model.ai!.security!,
              findings: parsed.findings,
              verificationChecks,
              overallRisk: parsed.overallRisk,
              securityMaturity: parsed.securityMaturity,
            },
          }, 'generate', generation);

          const entry: LLMSummaryEntry = {
            content: parsed.postureSummary,
            status: 'complete',
            provider,
            model: modelId,
            generatedAt,
          };
          this.manager.mergeSummaryKey(workspaceId, 'security', entry, generation);
        });
        return true;
      } else {
        console.error('[LLMSummary] security: JSON parse failed');
        const entry: LLMSummaryEntry = { content: '', status: 'failed', provider, model: modelId, generatedAt, error: 'JSON parse failed' };
        this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, 'security', entry, generation));
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[LLMSummary] FAILED key=security', message);
      const entry: LLMSummaryEntry = { content: '', status: 'failed', provider, model: modelId, generatedAt, error: message };
      this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, 'security', entry, generation));
      return false;
    }
  }

  private async _generateAndMerge(
    workspaceId: string,
    model: KnowledgeModel,
    generation: number,
    key: LLMSummaryKey,
    prompt: string,
    provider: string,
    modelId: string,
  ): Promise<boolean> {
    const generatedAt = new Date().toISOString();
    try {
      const text = await this._withTimeout(
        this.electron.aiExplain(prompt),
        LLM_TIMEOUT_MS,
        key,
      );

      if (text === null || text === undefined) {
        const entry: LLMSummaryEntry = { content: '', status: 'failed', provider, model: modelId, generatedAt, error: 'No response received' };
        this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, key, entry, generation));
        return false;
      }

      const entry: LLMSummaryEntry = { content: text, status: 'complete', provider, model: modelId, generatedAt };
      this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, key, entry, generation));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLMSummary] FAILED key=${key}`, message);
      const entry: LLMSummaryEntry = { content: '', status: 'failed', provider, model: modelId, generatedAt, error: message };
      this.ngZone.run(() => this.manager.mergeSummaryKey(workspaceId, key, entry, generation));
      return false;
    }
  }

  private _withTimeout<T>(promise: Promise<T>, ms: number, key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`LLM generate timed out after ${ms}ms for key=${key}`)),
        ms,
      );
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });
  }
}
