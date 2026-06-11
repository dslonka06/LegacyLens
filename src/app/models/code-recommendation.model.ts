export type RecommendationCategory = 'issues' | 'modernization' | 'security';
export type RecommendationSeverity = 'high' | 'medium' | 'low';

export interface CodeRecommendation {
  id: string;
  title: string;
  fileName: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  description: string;
  solution: string;
  // Optional keyword to search for and highlight in the file
  searchTerm?: string;
}
