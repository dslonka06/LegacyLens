import { WorkflowSummary } from './data-flow.model';

interface RepositoryInsight {
  title: string;
  description: string;
  severity: string;
  category: string;
}

// Context passed to AI for a repository-level explanation.
// Populated entirely from SystemLens knowledge — no raw source code.
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

export type ExplanationType = 'repository' | 'workflow';

export interface ExplanationResult {
  type: ExplanationType;
  title: string;
  content: string;
  generatedAt: string;
}
