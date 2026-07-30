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
  priorityScore: number;
  priorityRank: number;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  affectedArea: string;
  affectedFiles: string[];
  codeReference: CodeReference;
  issueDescription: string;
  whyItMatters: string;
  recommendedImprovement: string;
  expectedImpact: string;
}

export interface RecommendationAnalysis {
  criticalCount: number;
  highCount: number;
  technicalDebtLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  debtContext: string;
  modernizationReadiness: 'Not Ready' | 'Partially Ready' | 'Ready';
  modernizationContext: string;
  recommendations: Recommendation[];
  modernizationAssessment: string;
  generatedAt: string;
}
