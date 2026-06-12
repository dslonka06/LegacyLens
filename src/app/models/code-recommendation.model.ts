export type RecommendationCategory = 'issues' | 'modernization' | 'security';
export type RecommendationSeverity = 'high' | 'medium' | 'low' | 'info';
export type RecommendationRiskLevel = 'Low' | 'Medium' | 'High';

export interface CodeRecommendation {
  id: string;
  title: string;
  fileName: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  description: string;
  solution: string;
  searchTerm?: string;
  // Enriched fields — populated by AI-generated recommendations when available
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  explanation?: string;
  suggestedImprovement?: string;
  expectedImpact?: string;
  riskLevel?: RecommendationRiskLevel;
  dependenciesAffected?: string[];
}
