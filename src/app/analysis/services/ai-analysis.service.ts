import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { KnowledgeModel, AIStage, KnowledgeAIResults } from '@app/knowledge/models/knowledge-model.contract';
import type { SecurityAnalysis }       from '@app/analysis/models/security-analysis.model';
import type { SystemUnderstanding }    from '@app/analysis/models/system-understanding.model';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { LearningPathAnalysis }   from '@app/analysis/models/learning-path-analysis.model';

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
    private readonly manager:  WorkspaceManagerService,
  ) {}

  /**
   * Run all applicable AI stages for the given KnowledgeModel.
   * Each stage merges its result into workspace.knowledgeModel.ai as it completes.
   * Failures are isolated — one failed stage does not block others.
   */
  async runAll(workspaceId: string, model: KnowledgeModel): Promise<void> {
    if (!this.electron.isElectron) return;

    // security + understanding run concurrently first.
    // learningPath depends on understanding, so it runs after.
    // recommendations and documentation are independent.
    await Promise.all([
      this.runStage(workspaceId, model, 'security'),
      this.runStage(workspaceId, model, 'understanding'),
      this.runStage(workspaceId, model, 'recommendations'),
      this.runStage(workspaceId, model, 'documentation'),
    ]);

    // learningPath needs understanding to be present — read it from the workspace
    const ws = this.manager.getById(workspaceId);
    const updatedModel = ws?.knowledgeModel ?? model;
    await this.runStage(workspaceId, updatedModel, 'learningPath');
  }

  /**
   * Run a single AI stage. Merges the result into the workspace on success,
   * marks the stage failed on error. Never throws.
   */
  async runStage(workspaceId: string, model: KnowledgeModel, stage: AIStage): Promise<void> {
    try {
      const result = await this.callStage(model, stage);
      if (result !== null) {
        const completed = [
          ...(model.ai?.completedStages ?? []),
          stage,
        ] as AIStage[];

        this.manager.mergeAIResults(workspaceId, {
          ...this.stageResultToPartial(stage, result),
          completedStages: [...new Set(completed)],
          failedStages: model.ai?.failedStages ?? [],
        });
      }
    } catch {
      this.manager.markAIStageFailed(workspaceId, stage);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async callStage(model: KnowledgeModel, stage: AIStage): Promise<unknown> {
    switch (stage) {
      case 'security':
        return this.electron.intelligenceSecurity(model, null) as Promise<SecurityAnalysis>;

      case 'understanding':
        return this.electron.intelligenceSystemUnderstanding(model, null) as Promise<SystemUnderstanding>;

      case 'recommendations':
        return this.electron.intelligenceRecommendations(model, null) as Promise<RecommendationAnalysis>;

      case 'learningPath': {
        const understanding = model.ai?.understanding ?? null;
        return this.electron.intelligenceLearningPath(model, null, understanding, model.targetType) as Promise<LearningPathAnalysis>;
      }

      case 'documentation':
        return this.electron.buildContext('analysis', model) as Promise<unknown>;

      default:
        return null;
    }
  }

  private stageResultToPartial(stage: AIStage, result: unknown): Partial<KnowledgeAIResults> {
    switch (stage) {
      case 'security':        return { security:        result as SecurityAnalysis };
      case 'understanding':   return { understanding:   result as SystemUnderstanding };
      case 'recommendations': return { recommendations: result as RecommendationAnalysis };
      case 'learningPath':    return { learningPath:    result as LearningPathAnalysis };
      case 'documentation':   return { documentation:   result as any };
      default:                return {};
    }
  }
}
