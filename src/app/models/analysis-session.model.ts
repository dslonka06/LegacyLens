import { AnalysisResult } from './analysis-result.model';
import { AiAnalysisResult } from './ai-analysis-result.model';
import { WorkspaceProfile } from './workspace.model';
import { WorkspaceType } from './workspace-entity.model';

export interface AnalysisSession {
  scope: WorkspaceType;
  fileName: string;
  sourceCode: string;
  analysis: AnalysisResult;
  createdAt: string;
  aiAnalysis?: AiAnalysisResult;
  workspaceContext?: WorkspaceProfile;
}
