import { ArchitectureAnalysis } from './architecture-analysis.model';
import { ModernizationRecommendation } from './modernization-recommendation.model';

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
  architecture: ArchitectureAnalysis;
  modernizations: ModernizationRecommendation[];
  model: string;
  provider: string;
  generatedAtUtc: string;
}
