import { Injectable, NgZone } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { LLMSummaryService } from './llm-summary.service';
import type {
  KnowledgeModel,
  AIStage,
  KnowledgeAIResults,
} from '@app/knowledge/models/knowledge-model.contract';
import type { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';
import type { DataFlowAIAnalysis } from '@app/knowledge/models/data-flow-ai-analysis.model';

/**
 * AIAnalysisService — owns the async AI pipeline.
 *
 * Consumes a structural KnowledgeModel (no raw source files).
 * Runs AI stages concurrently where possible, merging each result back
 * into the workspace via WorkspaceManagerService as it completes.
 *
 * WorkspaceKnowledgeService calls runAll() after the structural phase.
 * Nothing else should call this service directly.
 */
@Injectable({ providedIn: 'root' })
export class AIAnalysisService {
  constructor(
    private readonly electron: ElectronService,
    private readonly manager: WorkspaceManagerService,
    private readonly llmSummary: LLMSummaryService,
    private readonly ngZone: NgZone,
  ) {}

  /**
   * Run all applicable AI stages for the given KnowledgeModel.
   * Each stage merges its result into workspace.knowledgeModel.ai as it completes.
   * Failures are isolated — one failed stage does not block others.
   *
   * @param generation  Cancellation token — if the value changes mid-run, results are dropped.
   */
  async runAll(workspaceId: string, model: KnowledgeModel, generation: number): Promise<void> {
    if (!this.electron.isElectron) return;

    // ── Derive tier ─────────────────────────────────────────────────────────────
    // Five of six derive stages run concurrently — they have no interdependencies.
    // learningPath depends on understanding completing first, so it runs after.
    const concurrentStages: Promise<void>[] = [
      this.runStage(workspaceId, model, 'security',        generation),
      this.runStage(workspaceId, model, 'understanding',   generation),
      this.runStage(workspaceId, model, 'recommendations', generation),
      this.runStage(workspaceId, model, 'dataFlow',        generation),
    ];
    // Architecture is not meaningful for a single file — skip it for file scope
    if (model.targetType !== 'file') {
      concurrentStages.push(this.runStage(workspaceId, model, 'architecture', generation));
    }
    await Promise.all(concurrentStages);

    // ── Hub narrative pass 2 — directive sentence ────────────────────────────
    // Security + recommendations are now resolved. Build the directive sentence
    // and patch it onto the existing hubNarrative (preserving structural).
    await this.runHubDirective(workspaceId, model.targetType ?? 'file', generation);

    // learningPath reads model.ai.understanding — fetch the updated model after the concurrent batch
    const wsAfterDerive = this.manager.getById(workspaceId);
    const modelAfterDerive = wsAfterDerive?.knowledgeModel ?? model;
    await this.runStage(workspaceId, modelAfterDerive, 'learningPath', generation);

    // ── Prompt + Generate tier ───────────────────────────────────────────────────
    // All derive stages are complete — run the LLM summary generation.
    // We pass the freshest model snapshot so all six summaries have access to
    // the full derive results including learningPath.
    const wsAfterAllDerive = this.manager.getById(workspaceId);
    const modelForGenerate = wsAfterAllDerive?.knowledgeModel ?? modelAfterDerive;
    await this.llmSummary.runAll(workspaceId, modelForGenerate, generation);

    // All stages done — flip status to ready so the hub shows the final state.
    this.ngZone.run(() => this.manager.markAIPipelineComplete(workspaceId));
  }

  /**
   * Run a single AI stage. Merges the result into the workspace on success,
   * marks the stage failed on error. Never throws.
   *
   * @param generation  If the workspace's current generation differs when the result
   *                    arrives, the result is silently discarded (re-analyze was triggered).
   */
  async runStage(
    workspaceId: string,
    model: KnowledgeModel,
    stage: AIStage,
    generation: number,
  ): Promise<void> {
    console.log(`[AI] stage start: ${stage} gen=${generation}`);
    this.ngZone.run(() => this.manager.setStageRunning(workspaceId, stage));
    try {
      const result = await this.callStage(model, stage);
      console.log(`[AI] stage done: ${stage} result=${result === null ? 'NULL' : result === undefined ? 'UNDEFINED' : 'ok'}`);

      if (result !== null) {
        const currentGen = this.manager.getGeneration(workspaceId);
        console.log(`[AI] stage merge: ${stage} gen=${generation} currentGen=${currentGen} match=${currentGen === generation}`);

        this.ngZone.run(() => {
          this.manager.mergeAIResults(
            workspaceId,
            this.stageResultToPartial(stage, result),
            stage,
            generation,
          );
        });
        console.log(`[AI] stage merged: ${stage}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AI] stage FAILED: ${stage}`, message);
      this.ngZone.run(() => this.manager.markAIStageFailed(workspaceId, stage, generation, message));
    } finally {
      this.ngZone.run(() => this.manager.clearStageRunning(workspaceId, stage));
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async runHubDirective(workspaceId: string, scope: string, generation: number): Promise<void> {
    try {
      const ws = this.manager.getById(workspaceId);
      const ai = ws?.knowledgeModel?.ai;
      if (!ai) return;

      const security = ai.security as { findings?: { severity?: string }[] } | undefined;
      const recommendations = ai.recommendations as { recommendations?: unknown[] } | undefined;

      const securityFindings = security?.findings ?? [];
      const directive = await this.electron.intelligenceHubDirective({
        securityCount:       securityFindings.length,
        securityHasCritical: securityFindings.some(f => f.severity === 'critical'),
        securityHasHigh:     securityFindings.some(f => f.severity === 'high'),
        recommendationCount: recommendations?.recommendations?.length ?? 0,
        scope,
      });

      if (!directive) return;

      const existingNarrative = ai.hubNarrative;
      if (!existingNarrative) return;

      this.ngZone.run(() => this.manager.mergeAIResults(
        workspaceId,
        { hubNarrative: { structural: existingNarrative.structural, directive } },
        'understanding',
        generation,
      ));
    } catch (err) {
      console.error('[AI] hub directive FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  private withTimeout<T>(promise: Promise<T>, stage: AIStage, ms = 30_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`stage timed out after ${ms}ms`)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  private async callStage(model: KnowledgeModel, stage: AIStage): Promise<unknown> {
    console.log(`[AI] callStage invoking IPC: ${stage}`);
    switch (stage) {
      case 'security':
        return this.withTimeout(
          this.electron.intelligenceSecurity(model) as Promise<SecurityAnalysis>,
          stage,
        );

      case 'understanding':
        return this.withTimeout(
          this.electron.intelligenceSystemUnderstanding(model) as Promise<SystemUnderstanding>,
          stage,
        );

      case 'recommendations':
        return this.withTimeout(
          this.electron.intelligenceRecommendations(model) as Promise<RecommendationAnalysis>,
          stage,
        );

      case 'learningPath': {
        const understanding = model.ai?.understanding ?? null;
        return this.withTimeout(
          this.electron.intelligenceLearningPath(
            model,
            understanding,
            model.targetType,
          ) as Promise<LearningPathAnalysis>,
          stage,
        );
      }

      case 'architecture':
        return this.withTimeout(
          this.electron.intelligenceArchitectureAnalysis(model) as Promise<ArchitectureAIAnalysis>,
          stage,
        );

      case 'dataFlow':
        return this.withTimeout(
          this.electron.intelligenceDataFlowAnalysis(model) as Promise<DataFlowAIAnalysis>,
          stage,
        );

      default:
        return null;
    }
  }

  private stageResultToPartial(stage: AIStage, result: unknown): Partial<KnowledgeAIResults> {
    switch (stage) {
      case 'security':
        return { security: result as SecurityAnalysis };
      case 'understanding': {
        const r = result as {
          understanding: SystemUnderstanding;
          hubNarrative: { structural: string; directive: string };
          businessPurposeNarrative?: string;
          codeHealthNarrative?: string;
          fileResponsibilitiesNarrative?: string[] | null;
          fileComponentsNarrative?: {
            items: Array<{ name: string; kind: 'class' | 'method'; description: string; isExported: boolean }>;
            imports: string[];
            exports: string[];
          } | null;
        };
        return {
          understanding: r.understanding,
          hubNarrative: r.hubNarrative,
          businessPurposeNarrative: r.businessPurposeNarrative,
          codeHealthNarrative: r.codeHealthNarrative,
          fileResponsibilitiesNarrative: r.fileResponsibilitiesNarrative ?? null,
          fileComponentsNarrative: r.fileComponentsNarrative ?? null,
        };
      }
      case 'recommendations':
        return { recommendations: result as RecommendationAnalysis };
      case 'learningPath':
        return { learningPath: result as LearningPathAnalysis };
      case 'architecture':
        return { architecture: result as ArchitectureAIAnalysis };
      case 'dataFlow': {
        const r = result as DataFlowAIAnalysis & {
          fileNarrative?: {
            pattern: { label: string; overview: string };
            stepNarrative: string[];
          } | null;
        };
        return {
          dataFlow: r as DataFlowAIAnalysis,
          dataFlowFileNarrative: r.fileNarrative ?? null,
        };
      }
      default:
        return {};
    }
  }
}
