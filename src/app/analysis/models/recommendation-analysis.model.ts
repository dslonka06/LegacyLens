export type RecommendationCategory =
  | 'architecture'
  | 'maintainability'
  | 'modernization'
  | 'reliability'
  | 'performance'
  | 'complexity'
  | 'technical-debt';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface CodeReference {
  fileName: string;
  methodOrClass?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  priorityScore: number; // 0–100 composite score; higher = act sooner
  priorityRank: number; // 1-based rank across all recommendations
  priority: RecommendationPriority;
  category: RecommendationCategory;
  affectedArea: string; // human-readable label, e.g. "Dependency Management"
  affectedFiles: string[];
  codeReference: CodeReference;
  issueDescription: string;
  whyItMatters: string;
  recommendedImprovement: string;
  expectedImpact: string;
  dependenciesAffected: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RecommendationAnalysis {
  overview: string;
  criticalCount: number;
  highCount: number;
  technicalDebtLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  debtContext: string;
  modernizationReadiness: 'Not Ready' | 'Partially Ready' | 'Ready';
  modernizationContext: string;
  recommendations: Recommendation[];
  improvementThemes: string[];
  modernizationAssessment: string;
  generatedAt: string;
}
