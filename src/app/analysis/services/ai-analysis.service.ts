import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type {
  KnowledgeModel,
  AIStage,
  KnowledgeAIResults,
} from '@app/knowledge/models/knowledge-model.contract';
import type { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';

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

    // security, understanding, and recommendations run concurrently.
    // learningPath depends on understanding, so it runs after.
    // documentation stage is omitted — its result is unused by the pipeline.
    await Promise.all([
      this.runStage(workspaceId, model, 'security', generation),
      this.runStage(workspaceId, model, 'understanding', generation),
      this.runStage(workspaceId, model, 'recommendations', generation),
    ]);

    // learningPath needs understanding to be present — read it from the workspace
    const ws = this.manager.getById(workspaceId);
    const updatedModel = ws?.knowledgeModel ?? model;
    await this.runStage(workspaceId, updatedModel, 'learningPath', generation);

    // All stages done — flip status to ready so the hub shows the final state.
    this.manager.markAIPipelineComplete(workspaceId);
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
    this.manager.setStageRunning(workspaceId, stage);
    try {
      const result = await this.callStage(model, stage);
      console.log(`[AI] stage done: ${stage} result=${result === null ? 'NULL' : result === undefined ? 'UNDEFINED' : 'ok'}`);

      if (result !== null) {
        const currentGen = this.manager.getGeneration(workspaceId);
        console.log(`[AI] stage merge: ${stage} gen=${generation} currentGen=${currentGen} match=${currentGen === generation}`);

        // Pass the stage result and let mergeAIResults union completedStages atomically
        // inside the same patch call. Reading completedStages here and passing a pre-built
        // list creates a race when concurrent stages finish at the same time.
        this.manager.mergeAIResults(
          workspaceId,
          this.stageResultToPartial(stage, result),
          stage,
          generation,
        );
        console.log(`[AI] stage merged: ${stage}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AI] stage FAILED: ${stage}`, message);
      this.manager.markAIStageFailed(workspaceId, stage, generation, message);
    } finally {
      this.manager.clearStageRunning(workspaceId, stage);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

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
          this.electron.intelligenceSecurity(model, null) as Promise<SecurityAnalysis>,
          stage,
        );

      case 'understanding':
        return this.withTimeout(
          this.electron.intelligenceSystemUnderstanding(model, null) as Promise<SystemUnderstanding>,
          stage,
        );

      case 'recommendations':
        return this.withTimeout(
          this.electron.intelligenceRecommendations(model, null) as Promise<RecommendationAnalysis>,
          stage,
        );

      case 'learningPath': {
        const understanding = model.ai?.understanding ?? null;
        return this.withTimeout(
          this.electron.intelligenceLearningPath(
            model,
            null,
            understanding,
            model.targetType,
          ) as Promise<LearningPathAnalysis>,
          stage,
        );
      }

      default:
        return null;
    }
  }

  private stageResultToPartial(stage: AIStage, result: unknown): Partial<KnowledgeAIResults> {
    switch (stage) {
      case 'security':
        return { security: result as SecurityAnalysis };
      case 'understanding':
        return { understanding: result as SystemUnderstanding };
      case 'recommendations':
        return { recommendations: result as RecommendationAnalysis };
      case 'learningPath':
        return { learningPath: result as LearningPathAnalysis };
      case 'documentation':
        return {};
      default:
        return {};
    }
  }
}
