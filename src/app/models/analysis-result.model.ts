import { RiskItem } from './risk-item.model';
import { ModernizationItem } from './modernization-item.model';

export interface AnalysisResult {
  // Core metadata
  language: string;
  type: string;
  complexity: string;
  maintainability: string;

  // Primary summaries
  summary: string;
  businessPurpose: string;
  simplifiedExplanation: string;

  // Structured findings
  risks: RiskItem[];
  modernizationSuggestions: ModernizationItem[];

  // Deep-dive fields
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  developerNotes: string;

  // Architecture
  architecture: string;
  architectureLayers: string[];
  patterns: string[];

  // Data flow
  dataFlow: string;

  // Security
  security: string;

  // Explain simpler
  howItWorks: string;
  whyItExists: string;
  whatToLearnFirst: string[];
  commonMistakes: string[];
  suggestedNextFiles: string[];
}
