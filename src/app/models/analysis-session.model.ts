import { AnalysisResult } from './analysis-result.model';
import { AiAnalysisResult } from './ai-analysis-result.model';
import { WorkspaceProfile } from './workspace.model';
import { WorkspaceScope } from './modified-file.model';

export interface AnalysisSession {
  scope: WorkspaceScope;
  fileName: string;
  sourceCode: string;
  analysis: AnalysisResult;
  createdAt: string;
  aiAnalysis?: AiAnalysisResult;
  workspaceContext?: WorkspaceProfile;
}
