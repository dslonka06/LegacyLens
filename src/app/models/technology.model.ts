export type TechnologyCategory =
  | 'Framework'
  | 'Runtime'
  | 'BuildTool'
  | 'ContainerOrOrchestration'
  | 'CI_CD'
  | 'Database'
  | 'TestingFramework'
  | 'PackageManager'
  | 'Other';

export type DetectionMethod = 'filename' | 'content' | 'dependency';

export interface TechnologyDetectionResult {
  technology: string;
  category: TechnologyCategory;
  confidence: number;
  detectionMethod: DetectionMethod;
  // Source file that triggered the detection — useful for UI and Stage 3 tracing
  sourceFile: string;
}

// Convenience view — derived from TechnologyDetectionResult where category === 'Framework'
export interface FrameworkInfo {
  name: string;
  confidence: number;
  detectionMethod: DetectionMethod;
}

// Generic named technology — for display purposes
export interface TechnologyInfo {
  name: string;
  category: TechnologyCategory;
  confidence: number;
}
