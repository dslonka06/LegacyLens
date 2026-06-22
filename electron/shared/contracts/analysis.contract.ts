/**
 * Analysis result types — outputs of all analysis and intelligence engines.
 * Shared between Angular renderer and Electron main process.
 */

import { WorkflowSummary, BehaviorInsights } from './data-flow.contract';

// ── Common primitives ────────────────────────────────────────────────────────

export interface RiskItem {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ModernizationItem {
  description: string;
  priority: 'low' | 'medium' | 'high';
}

// ── Single-file Analysis ─────────────────────────────────────────────────────

export interface AnalysisResult {
  language: string;
  type: string;
  complexity: string;
  maintainability: string;
  summary: string;
  businessPurpose: string;
  simplifiedExplanation: string;
  risks: RiskItem[];
  modernizationSuggestions: ModernizationItem[];
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  developerNotes: string;
  architecture: string;
  architectureLayers: string[];
  patterns: string[];
  dataFlow: string;
  security: string;
  howItWorks: string;
  whyItExists: string;
  whatToLearnFirst: string[];
  commonMistakes: string[];
  suggestedNextFiles: string[];
}

// ── Security ─────────────────────────────────────────────────────────────────

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export type SecurityFindingCategory =
  | 'secrets-management'
  | 'authentication'
  | 'authorization'
  | 'input-validation'
  | 'sql-injection'
  | 'file-access'
  | 'external-calls'
  | 'configuration'
  | 'broad-access'
  | 'ai-finding';

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  category: SecurityFindingCategory;
  fileName: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  issueDescription: string;
  riskExplanation: string;
  remediation: string;
  affectedComponents: string[];
  affectedWorkflows: string[];
}

export interface SecurityHotspot {
  name: string;
  findingCount: number;
  riskLevel: SecuritySeverity;
  explanation: string;
}

export interface SecurityRelevantComponent {
  name: string;
  filePath: string;
  reason: string;
  role: string;
  patterns: string[];
}

export interface SecurityAnalysis {
  executiveSummary: string;
  summary: string;
  overallRisk: SecuritySeverity;
  securityMaturity: 'Low' | 'Medium' | 'High';
  maturityContext: string;
  riskContext: string;
  findings: SecurityFinding[];
  hotspots: SecurityHotspot[];
  relevantComponents: SecurityRelevantComponent[];
  recommendationThemes: string[];
  readinessAssessment: string;
  generatedAt: string;
}

// ── Recommendations ──────────────────────────────────────────────────────────

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
  dependenciesAffected: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RecommendationAnalysis {
  overview: string;
  criticalCount: number;
  highCount: number;
  technicalDebtLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  debtContext: string;
  modernizationReadiness: 'Not Ready' | 'Partially Ready' | 'Ready';
  modernizationContext: string;
  recommendations: Recommendation[];
  improvementThemes: string[];
  modernizationAssessment: string;
  generatedAt: string;
}

// ── System Understanding ─────────────────────────────────────────────────────

export type HealthLevel = 'Low' | 'Medium' | 'High';
export type CriticalityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SystemHealthSummary {
  complexity: HealthLevel;
  maintainability: HealthLevel;
  riskLevel: HealthLevel;
  modernizationReadiness: HealthLevel;
  interpretation: string;
}

export interface ImportantItem {
  name: string;
  path: string;
  whyImportant: string;
}

export interface ImportantWorkflow {
  name: string;
  description: string;
}

export interface ImportantDependency {
  name: string;
  type: 'external' | 'internal' | 'framework' | 'database' | 'queue' | 'storage';
  whyImportant: string;
}

export interface TechDebtHotspot {
  name: string;
  reason: string;
  impact: string;
}

export interface CoreCapability {
  name: string;
  description: string;
  businessValue: string;
}

export interface SystemUnderstanding {
  scope: 'file' | 'folder' | 'repository';
  executiveSummary: string;
  businessPurpose: string;
  whyItMatters: string;
  keyResponsibilities: string[];
  keyWorkflows: string[];
  criticalAreas: string[];
  highRiskAreas: string[];
  mostImportantItems: ImportantItem[];
  coreCapabilities: CoreCapability[];
  businessCriticality: CriticalityLevel;
  businessCriticalityReason: string;
  health: SystemHealthSummary;
  understandingNarrative: string;
  technicalDebtHotspots: TechDebtHotspot[] | null;
  mostImportantWorkflows: ImportantWorkflow[] | null;
  mostImportantDependencies: ImportantDependency[] | null;
  generatedAt: string;
}

// ── Learning Path ─────────────────────────────────────────────────────────────

export interface LearningStep {
  stepNumber: number;
  title: string;
  goal: string;
  whyItMatters: string;
  recommendedFiles: string[];
  recommendedFolders: string[];
  checkpoints: string[];
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
  suggestedFiles: string[];
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

// ── Repository Summary ───────────────────────────────────────────────────────

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
  description: string;
  available: boolean;
}

export interface KeyFile {
  name: string;
  path: string;
  reason: string;
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
  workspaceName: string;
  workspaceType: string;
  generatedAt: string;
  totalFiles: number;
  languages: string[];
  technologies: string[];
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
  workflowSummaries?: WorkflowSummary[];
  behaviorInsights?: BehaviorInsights;
}
