import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceContext } from './workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from '@app/knowledge/models/knowledge.model';
import { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import { ExplanationResult } from '@app/analysis/models/ai-explanation-context.model';

export type WorkspaceType = 'file' | 'folder' | 'repository';

export type WorkspaceStatus =
  | 'empty'      // created, nothing uploaded yet
  | 'loaded'     // content uploaded, analysis complete
  | 'analyzing'; // knowledge pipeline running

export const MAX_WORKSPACES = 3;

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  createdAt: string;
  lastModifiedAt: string;
  session:        AnalysisSession | null;
  context:        WorkspaceContext | null;
  knowledge:        RepositoryKnowledge | null;
  knowledgeState:   KnowledgeState;
  securityAnalysis: SecurityAnalysis | null;
  securityOverview: string | null;
  systemUnderstanding: SystemUnderstanding | null;
  recommendationAnalysis: RecommendationAnalysis | null;
  learningPathAnalysis: LearningPathAnalysis | null;
  aiExplanation: ExplanationResult | null;
}
