import { AnalysisResult } from './analysis-result.model';
import { AiAnalysisResult } from './ai-analysis-result.model';
import { WorkspaceProfile } from './workspace.model';

export interface AnalysisSession {
  fileName: string;
  sourceCode: string;
  analysis: AnalysisResult;
  createdAt: string;
  // AI-generated content lives here — separate from pattern-based analysis.
  // Populated after a successful backend call; absent when AI is unavailable.
  aiAnalysis?: AiAnalysisResult;
  // Workspace context — populated when multiple files are uploaded.
  // Absent for single-file sessions to preserve backward compatibility.
  workspaceContext?: WorkspaceProfile;
}
