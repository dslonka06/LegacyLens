export type AnalysisType = 'file' | 'folder' | 'repository';

export interface HistoryEntry {
  id: string;
  analysisType: AnalysisType;
  name: string;
  createdAt: string;
  // Optional fingerprint metadata — never contains code or analysis output
  language?: string;
  fileCount?: number;
  description?: string;
}
