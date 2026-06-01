import { AnalysisResult } from './analysis-result.model';

export interface AnalysisSession {
  fileName: string;
  sourceCode: string;
  analysis: AnalysisResult;
  createdAt: string;
}
