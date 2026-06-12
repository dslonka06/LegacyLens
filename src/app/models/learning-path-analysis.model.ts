export interface LearningStep {
  stepNumber: number;
  title: string;
  whatYouAreLearning: string;
  whyItMatters: string;
  whatYouWillGain: string;
  whereToNext: string;
}

export interface KeyConcept {
  name: string;
  plainEnglishDefinition: string;
  whyItMatters: string;
  whereItAppears: string;
}

export interface SystemArea {
  name: string;
  responsibility: string;
  whyItMatters: string;
  whenToLearnIt: string;
}

export interface SuggestedReadingItem {
  rank: number;
  label: string;
  path?: string;
  reason: string;
}

export interface IgnoreForNow {
  area: string;
  reason: string;
}

export interface NextStepLink {
  destination: string;
  route: string;
  guidance: string;
}

export interface LearningPathAnalysis {
  scope: 'file' | 'folder' | 'repository';
  welcomeTitle: string;
  welcomeSummary: string;
  systemType: string;
  focusFirst: string;
  roadmap: LearningStep[];
  keyConcepts: KeyConcept[];
  systemAreas: SystemArea[];
  suggestedReadingOrder: SuggestedReadingItem[];
  ignoreForNow: IgnoreForNow[];
  nextSteps: NextStepLink[];
  generatedAt: string;
}
