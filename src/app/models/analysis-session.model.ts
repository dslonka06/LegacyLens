import { AnalysisResult } from './analysis-result.model';
import { AiAnalysisResult } from './ai-analysis-result.model';

export interface AnalysisSession {
  fileName: string;
  sourceCode: string;
  analysis: AnalysisResult;
  createdAt: string;
  // AI-generated content lives here — separate from pattern-based analysis.
  // Populated after a successful backend call; absent when AI is unavailable.
  aiAnalysis?: AiAnalysisResult;
}
