export interface ArchitectureLayerBreakdown {
  name: string;
  fileCount: number;
  responsibility: string;
  couplingNotes: string;
}

export interface ArchitectureAIAnalysis {
  dominantPattern: string;
  patternConfidence: number;
  competingPatterns: { name: string; confidence: number; indicators: string[] }[];
  layerBreakdown: ArchitectureLayerBreakdown[];
  hubCount: number;
  circularDependencyCount: number;
  couplingAssessment: 'Low' | 'Moderate' | 'High' | 'Critical';
  evolutionRisk: 'Low' | 'Moderate' | 'High';
  boundaryViolations: string[];
  generatedAt: string;
}
