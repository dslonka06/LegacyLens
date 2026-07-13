import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel } from '../../../electron';
import type {
  RepositoryExplanationContext,
  WorkflowExplanationContext,
} from '../models/ai-explanation-context.model';
import type { WorkflowSummary } from '../models/data-flow.model';
import type { SecurityAnalysis } from '../models/security-analysis.model';
import type { SecurityOverviewContext } from '@app/ai/prompts/security-overview-prompt';

export interface AnalysisContext {
  targetType: string;
  languages: string[];
  technologies: string[];
  frameworks: string[];
  totalFiles: number;
  projects: Array<{ name: string; type: string; framework: string }>;
  architecturePatterns: string[];
  dependencyEdgeCount: number;
  dependencyNodeCount: number;
  symbolCounts: { classes: number; methods: number; imports: number };
  gitAnalysis: { available: boolean; branch?: string | null; originUrl?: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class ContextService {
  constructor(private readonly electron: ElectronService) {}

  /**
   * Build a RepositoryExplanationContext from a KnowledgeModel.
   * Used by AI repository explanation and documentation generation.
   */
  async buildRepositoryContext(
    model: KnowledgeModel,
    workspaceName?: string,
  ): Promise<RepositoryExplanationContext | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.buildContext('repository', model, {
      workspaceName,
    }) as Promise<RepositoryExplanationContext | null>;
  }

  /**
   * Build a WorkflowExplanationContext for a specific workflow.
   */
  async buildWorkflowContext(
    model: KnowledgeModel,
    workflow: WorkflowSummary,
    workspaceName?: string,
  ): Promise<WorkflowExplanationContext | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.buildContext('workflow', model, {
      workflow,
      workspaceName,
    }) as Promise<WorkflowExplanationContext | null>;
  }

  /**
   * Build a SecurityOverviewContext for the AI security narrative.
   */
  async buildSecurityContext(
    model: KnowledgeModel,
    securityAnalysis: SecurityAnalysis,
    scope: 'file' | 'folder' | 'repository' = 'repository',
    workspaceName?: string,
  ): Promise<SecurityOverviewContext | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.buildContext('security', model, {
      securityAnalysis,
      scope,
      workspaceName,
    }) as Promise<SecurityOverviewContext | null>;
  }

  /**
   * Build a shared AnalysisContext used by SystemUnderstanding, Recommendations,
   * and LearningPath engines — gives them structured metadata without re-parsing.
   */
  async buildAnalysisContext(model: KnowledgeModel): Promise<AnalysisContext | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.buildContext('analysis', model, {}) as Promise<AnalysisContext | null>;
  }
}
