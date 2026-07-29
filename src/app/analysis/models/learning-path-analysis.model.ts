export interface CodeLocation {
  label: string;
  lineStart?: number;
  lineEnd?: number;
  filePaths?: string[];
}

export interface LearningStep {
  stepNumber: number;
  title: string;
  description: string;
  whyHere: string;
  codeLocations: CodeLocation[];
  checkpoints: string[];
}

export interface LearningPathAnalysis {
  scope: 'file' | 'folder' | 'repository';
  welcomeTitle: string;
  welcomeSummary: string;
  systemType: string;
  focusFirst: string;
  roadmap: LearningStep[];
  generatedAt: string;
}
