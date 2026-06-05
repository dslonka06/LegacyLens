// ── Stage 3 Repository Knowledge models ──────────────────────────────────────
// Kept strictly separate from RepositoryStructure (Stage 2).
// Structure answers: what exists?
// Knowledge answers: how does it work?

export interface SourceFile {
  path: string;
  extension: string;
  content: string;
}

// ── Dependency Graph ──────────────────────────────────────────────────────────

export interface DependencyNode {
  id: string;
  name: string;
  type: string;   // e.g. 'module', 'class', 'namespace', 'table'
  path: string;
}

export interface DependencyEdge {
  source: string;  // DependencyNode.id
  target: string;  // DependencyNode.id
  relationshipType: string;  // e.g. 'import', 'using', 'references'
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// ── Architecture ──────────────────────────────────────────────────────────────

export interface ArchitecturePattern {
  name: string;
  confidence: number;
  indicators: string[];  // folder names or dependency patterns that triggered detection
}

// Named RepositoryArchitectureAnalysis to avoid collision with the existing
// single-file ArchitectureAnalysis in architecture-analysis.model.ts
export interface RepositoryArchitectureAnalysis {
  patterns: ArchitecturePattern[];
}

// ── Knowledge State ───────────────────────────────────────────────────────────

export enum KnowledgeState {
  NotStarted        = 'NotStarted',
  ReadingFiles      = 'ReadingFiles',
  BuildingDependencies = 'BuildingDependencies',
  DetectingArchitecture = 'DetectingArchitecture',
  Complete          = 'Complete',
  Failed            = 'Failed',
}

// ── Root Knowledge Model ──────────────────────────────────────────────────────

export interface RepositoryKnowledge {
  sourceFiles: SourceFile[];
  dependencyGraph?: DependencyGraph;
  architecture?: RepositoryArchitectureAnalysis;
  // Timestamp so consumers can detect stale data
  builtAt: string;
}
