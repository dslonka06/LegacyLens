// RepositorySummary is the central knowledge model for documentation and future AI features.
// It aggregates RepositoryKnowledge, RepositoryStructure, WorkspaceProfile, and AnalysisSession
// into a single source of truth regardless of workspace type.

import { BehaviorInsights, WorkflowSummary } from './data-flow.model';

export type DocumentationSectionId =
  | 'executive-summary'
  | 'repository-overview'
  | 'architecture-overview'
  | 'data-flow'
  | 'dependency-analysis'
  | 'risk-assessment'
  | 'modernization'
  | 'key-files'
  | 'key-projects'
  | 'repository-insights'
  | 'onboarding-guide';

export interface DocumentationSection {
  id: DocumentationSectionId;
  title: string;
  description: string; // One-sentence description for the selection UI
  available: boolean;
}

export interface KeyFile {
  name: string;
  path: string;
  reason: string; // Why this file is considered key
  connectionCount?: number;
}

export interface KeyProject {
  name: string;
  path: string;
  type: string;
  framework: string;
  language: string;
}

export interface RiskSummaryItem {
  title: string;
  description: string;
  severity: string;
}

// Named ModernizationSummaryItem to distinguish from ModernizationItem in modernization-item.model.ts
// (which carries a priority field). This is the simplified form used in RepositorySummary.
export interface ModernizationSummaryItem {
  title: string;
  description: string;
}

export interface InsightSummaryItem {
  title: string;
  description: string;
  severity: string;
}

export interface RepositorySummary {
  // Metadata
  workspaceName: string;
  workspaceType: string;
  generatedAt: string;
  totalFiles: number;
  languages: string[];
  technologies: string[];

  // Section content — all optional; undefined means not available for this workspace
  executiveSummary?: string;
  repositoryOverview?: string;
  architectureSummary?: string;
  architecturePatterns?: Array<{ name: string; confidence: number; indicators: string[] }>;
  dataFlowSummary?: string;
  dependencySummary?: string;
  dependencyStats?: { nodes: number; edges: number; averageConnectivity: number };
  risks?: RiskSummaryItem[];
  modernizations?: ModernizationSummaryItem[];
  keyFiles?: KeyFile[];
  keyProjects?: KeyProject[];
  insights?: InsightSummaryItem[];
  onboardingNotes?: string;
  onboardingSteps?: string[];
  // Stage 7: behavior & data flow intelligence
  workflowSummaries?: WorkflowSummary[];
  behaviorInsights?: BehaviorInsights;
}
