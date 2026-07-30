/**
 * KnowledgeModel — the application's single source of truth for all analyzed content.
 *
 * RULES:
 *   1. WorkspaceKnowledgeService is the ONLY service allowed to construct or mutate this.
 *   2. All consumers (pages, AI engines, export services) read from it. Never write to it.
 *   3. Pages gate sections on `capabilities`. Never branch on `targetType`.
 *   4. The model is organized around what the application KNOWS, not how it learned it.
 *
 * LAYERS:
 *   metadata      — what was analyzed and how the build went
 *   structure     — what objectively exists (files, symbols, projects, folder tree)
 *   relationships — how objective things connect (dependencies, architecture, git)
 *   insights      — deterministic conclusions derived from code (complexity, risks, data flow)
 *   ai            — everything produced by an LLM
 */

import type { TechnologyDetectionResult } from './technology.model';
import type { FolderNode, ProjectNode } from './repository.model';
import type { DependencyGraph } from './knowledge.model';
import type { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import type { ArchitectureAIAnalysis } from './architecture-ai-analysis.model';
import type { DataFlowAIAnalysis } from './data-flow-ai-analysis.model';
import type { LLMSummaries } from './llm-summaries.model';

// ── Target type ────────────────────────────────────────────────────────────────

export type AnalysisTargetType = 'file' | 'folder' | 'repository';

// ── Capabilities ───────────────────────────────────────────────────────────────
// Pages gate sections on this array. Never branch on targetType.

export type KnowledgeCapability =
  | 'fileParsing'
  | 'languageDetection'
  | 'symbolExtraction'
  | 'folderStructure'
  | 'frameworkDetection'
  | 'dependencyResolution'
  | 'multiProject'
  | 'gitAnalysis'
  | 'architectureDiscovery'
  | 'insightExtraction'; // deterministic insights available (complexity, risks, data flow)

// ── AI pipeline stages ─────────────────────────────────────────────────────────

// ── Stage groupings ────────────────────────────────────────────────────────────
// Derive stages: heuristic engines populate model.ai.* structured data.
// Prompt stage:  builds LLM prompts from derived data (one per page).
// Generate stage: calls the LLM for each prompt, stores narrative text.
// Finalise is implicit — handled by markAIPipelineComplete.

export type AIStage =
  // Derive tier — heuristic analysis engines
  | 'understanding'
  | 'security'
  | 'recommendations'
  | 'learningPath'
  | 'architecture'
  | 'dataFlow'
  // Prompt tier — builds structured prompts from derived data
  | 'prompt'
  // Generate tier — LLM calls, produces narrative text
  | 'generate'
  // Legacy / unused
  | 'documentation';

// ── Structure sub-types ────────────────────────────────────────────────────────

export interface SymbolSummary {
  classes: string[];
  methods: string[];
  imports: string[];
  exports: string[];
  language: string;
  type: string;
}

export interface KnowledgeStructure {
  /** Total file count across the analyzed target. */
  totalFiles: number;
  /** All detected languages, most prevalent first. */
  languages: string[];
  /** Detected frameworks (e.g. Angular, React, ASP.NET). */
  frameworks: string[];
  /** Full technology detection results including category and confidence. */
  technologies: TechnologyDetectionResult[];
  /** Symbol index keyed by file path. Present when 'symbolExtraction' capability ran. */
  symbols: Record<string, SymbolSummary>;
  /** Folder hierarchy. Present when 'folderStructure' capability ran. */
  folderTree?: FolderNode;
  /** Discovered sub-projects. Present when 'multiProject' capability ran. */
  projects?: ProjectNode[];
  /** File-scope only: the analyzed source code (persisted — file targets are small). */
  sourceCode?: string;
  /** File-scope only: absolute path to the analyzed file. */
  filePath?: string;
  /** File-scope only: detected language of the file. */
  fileLanguage?: string;
}

// ── Relationships sub-types ────────────────────────────────────────────────────

export interface ArchitecturePattern {
  name: string;
  confidence: number;
  indicators: string[]; // folder names or dependency patterns that triggered detection
}

export interface DependencyHub {
  nodeId: string;
  name: string;
  inboundCount: number;
  isHub: boolean;
}

export interface FileRanking {
  nodeId: string;
  name: string;
  degree: number;
}

export interface KnowledgeRelationships {
  /** Full dependency graph. Present when 'dependencyResolution' capability ran. */
  dependencies?: {
    graph: DependencyGraph;
    /** Most-connected nodes — derived from graph, never stored separately. */
    hubs: DependencyHub[];
    /** Files ranked by total connection degree. */
    ranks: FileRanking[];
  };
  /** Detected architecture patterns. Present when 'architectureDiscovery' capability ran. */
  architecture?: {
    patterns: ArchitecturePattern[];
  };
  /** Git metadata. Present when 'gitAnalysis' capability ran. */
  git?: {
    available: boolean;
    branch: string | null;
    originUrl: string | null;
  };
}

// ── Insights sub-types ─────────────────────────────────────────────────────────
// Deterministic conclusions derived from code. No LLM required.

export interface DataFlowInsight {
  /** Ordered processing steps, e.g. ['parseRequest', 'validateInput', 'persist']. */
  steps: string[];
  inputs: string[];
  outputs: string[];
}

export interface RiskInsight {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
}

export interface KnowledgeInsights {
  /** Deterministic data flow. Present for file targets when 'insightExtraction' ran. */
  dataFlow?: DataFlowInsight;
  /** Complexity level derived from cyclomatic / structural analysis. */
  complexity?: 'Low' | 'Medium' | 'High';
  /** Maintainability level derived from structural metrics. */
  maintainability?: 'Low' | 'Medium' | 'High';
  /** Deterministic risks derived from code patterns (not AI). */
  risks?: RiskInsight[];
  /** Files/areas flagged as hotspots by structural analysis. */
  hotspots?: string[];
  /** Key responsibilities extracted from structural analysis (file scope). */
  responsibilities?: string[];
}

// ── AI results ─────────────────────────────────────────────────────────────────
// Populated asynchronously after structural build. Model is usable before this arrives.
// `explanation` is collapsed into `understanding` — understanding is the single
// source of all AI narrative about the analyzed artifact.

export interface KnowledgeAIResults {
  // ── Derive tier ──────────────────────────────────────────────────────────────
  /** Full AI understanding: executive summary, business purpose, health, key areas. */
  understanding?: SystemUnderstanding;
  /** Heuristic hub header narrative. Structural pass available after derive; directive
   *  sentence appended once security + recommendations stages complete. */
  hubNarrative?: { structural: string; directive: string };
  businessPurposeNarrative?: string;
  codeHealthNarrative?: string;
  /** File scope only: per-responsibility descriptions from heuristic engine. */
  fileResponsibilitiesNarrative?: string[] | null;
  /** File scope only: per-component descriptions from heuristic engine. */
  fileComponentsNarrative?: {
    items: Array<{ name: string; kind: 'class' | 'method'; description: string; isExported: boolean }>;
    imports: string[];
    exports: string[];
  } | null;
  /** Security findings and risk surface produced by heuristic scanning. */
  security?: SecurityAnalysis;
  /** Actionable improvement recommendations from structural analysis. */
  recommendations?: RecommendationAnalysis;
  /** Guided onboarding learning path. */
  learningPath?: LearningPathAnalysis;
  /** Architecture pattern analysis with layer breakdown and coupling assessment. */
  architecture?: ArchitectureAIAnalysis;
  /** Data flow workflow analysis with entry points, bottlenecks, and risk profiles. */
  dataFlow?: DataFlowAIAnalysis;
  /** File scope only: heuristic narrative for the data flow page. */
  dataFlowFileNarrative?: {
    pattern: { label: string; overview: string };
    stepNarrative: string[];
  } | null;

  // ── Generate tier ─────────────────────────────────────────────────────────────
  /** LLM-generated narrative summaries, one per page. Populated after the generate stage. */
  summaries?: LLMSummaries;

  // ── Stage tracking ────────────────────────────────────────────────────────────
  /** AI stages that completed successfully. */
  completedStages: AIStage[];
  /** AI stages that failed — partial results remain usable. */
  failedStages: AIStage[];
  /** AI stages that partially succeeded (some sub-operations succeeded, some failed). */
  partialStages?: AIStage[];
  /** Error messages keyed by stage — present only for failed stages. */
  stageErrors?: Partial<Record<AIStage, string>>;
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export interface KnowledgeMetadata {
  /** ISO timestamp of last full or partial structural build. */
  builtAt: string;
  /** Schema version — increment when shape changes incompatibly. */
  schemaVersion: '2' | '3';
  /** Opaque ID linking this model to its SQLite persistence row. */
  buildId?: string;
  /** True when this model was restored from cache without a fresh scan. */
  fromCache?: boolean;
  /** True when only changed files were re-processed (incremental update). */
  partialRebuild?: boolean;
  /** Absolute path to the repository root. Present for folder/repository targets only. */
  repositoryPath?: string;
}

// ── Root contract ──────────────────────────────────────────────────────────────

export interface KnowledgeModel {
  // ── Identity ─────────────────────────────────────────────────────────────────
  targetType: AnalysisTargetType;
  workspaceName: string | null;

  // ── Capabilities ─────────────────────────────────────────────────────────────
  // Gate UI sections on this. Never branch on targetType.
  capabilities: KnowledgeCapability[];
  capabilityErrors: Record<string, string>;

  // ── Metadata ──────────────────────────────────────────────────────────────────
  metadata: KnowledgeMetadata;

  // ── Knowledge layers ──────────────────────────────────────────────────────────
  structure: KnowledgeStructure;
  relationships: KnowledgeRelationships;
  insights: KnowledgeInsights;

  // ── AI results ────────────────────────────────────────────────────────────────
  // Populated asynchronously by AIAnalysisService after structural build completes.
  ai?: KnowledgeAIResults;
}
