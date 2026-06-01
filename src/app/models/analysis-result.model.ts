import { RiskItem } from './risk-item.model';
import { ModernizationItem } from './modernization-item.model';

export interface AnalysisResult {
  language: string;
  type: string;
  complexity: string;
  maintainability: string;
  summary: string;
  businessPurpose: string;
  simplifiedExplanation: string;
  risks: RiskItem[];
  modernizationSuggestions: ModernizationItem[];
  dataFlow: string;
  architecture: string;
  security: string;
}
