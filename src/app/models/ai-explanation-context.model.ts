import { WorkflowSummary, BehaviorInsights } from './data-flow.model';
import { RepositoryInsight } from '../services/repository-insights.service';

// Context passed to AI for a repository-level explanation.
// Populated entirely from LegacyLens knowledge — no raw source code.
export interface RepositoryExplanationContext {
  workspaceName: string;
  workspaceType: string;
  languages: string[];
  technologies: string[];
  totalFiles: number;
  projectNames: string[];
  architecturePatterns: Array<{ name: string; confidence: number; indicators: string[] }>;
  topWorkflows: WorkflowSummary[];
  insights: Pick<RepositoryInsight, 'title' | 'description' | 'severity' | 'category'>[];
  keyFiles: Array<{ name: string; reason: string }>;
  executiveSummary?: string;
  dependencyStats?: { nodes: number; edges: number };
}

// Context passed to AI for a single workflow explanation.
export interface WorkflowExplanationContext {
  workspaceName: string;
  workflow: WorkflowSummary;
  relatedNodeNames: string[];
  architecturePatterns: string[];
}

// Context passed to AI for onboarding guide generation.
export interface OnboardingGuideContext {
  workspaceName: string;
  workspaceType: string;
  languages: string[];
  technologies: string[];
  totalFiles?: number;
  architecturePatterns: Array<{ name: string; confidence: number }>;
  topWorkflows: WorkflowSummary[];
  keyFiles: Array<{ name: string; reason: string }>;
  projectNames: string[];
  insights: Pick<RepositoryInsight, 'title' | 'description' | 'severity'>[];
  dependencyStats?: { nodes: number; edges: number };
  executiveSummary?: string;
}

// Union discriminant for the explanation panel to know what it is displaying.
export type ExplanationType = 'repository' | 'workflow' | 'onboarding';

export interface ExplanationResult {
  type: ExplanationType;
  title: string;
  content: string;
  generatedAt: string;
}
