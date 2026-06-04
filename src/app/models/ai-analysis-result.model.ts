export interface AiRisk {
  title: string;
  severity: string;
  description: string;
}

export interface AiAnalysisResult {
  summary: string;
  businessPurpose: string;
  explainSimpler: string;
  risks: AiRisk[];
  model: string;
  provider: string;
  generatedAtUtc: string;
}
