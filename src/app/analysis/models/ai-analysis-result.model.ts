import { ArchitectureAnalysis } from '@app/knowledge/models/architecture-analysis.model';
import { ModernizationRecommendation } from './modernization-recommendation.model';
import { GeneratedDocumentation } from './generated-documentation.model';

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
  documentation: GeneratedDocumentation;
  model: string;
  provider: string;
  generatedAtUtc: string;
}
