/**
 * Canonical repository structure and dependency graph types.
 * Shared between Angular renderer and Electron main process.
 *
 * Angular models in src/app/knowledge/models/ should eventually
 * import from here rather than defining their own copies.
 */

// ── File / Folder Structure ──────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
}

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  files: FileNode[];
  totalFileCount: number;
}

export type ProjectType =
  | 'AngularApplication'
  | 'ReactApplication'
  | 'VueApplication'
  | 'AspNetApi'
  | 'AspNetMvc'
  | 'ClassLibrary'
  | 'SharedLibrary'
  | 'DatabaseProject'
  | 'NodeApplication'
  | 'PythonApplication'
  | 'RustApplication'
  | 'GoApplication'
  | 'JavaApplication'
  | 'Unknown';

export interface ProjectNode {
  name: string;
  path: string;
  type: ProjectType;
  framework: string;
  language: string;
  projectFile: string;
}

export interface RepositoryStructure {
  root: FolderNode;
  projects: ProjectNode[];
  maxDepth: number;
  totalFileCount: number;
}

// ── Source Files ─────────────────────────────────────────────────────────────

export interface SourceFile {
  path: string;
  extension: string;
  content: string;
}

export interface FileMetadata {
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
}

// ── Dependency Graph ─────────────────────────────────────────────────────────

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relationshipType: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// ── Architecture ─────────────────────────────────────────────────────────────

export interface ArchitecturePattern {
  name: string;
  confidence: number;
  indicators: string[];
}

export interface RepositoryArchitectureAnalysis {
  patterns: ArchitecturePattern[];
}

// ── Repository Library (Phase 1 IPC proof-of-concept) ───────────────────────

export interface Repository {
  id: string;
  name: string;
  path: string;
  addedAt: string;
  lastOpenedAt: string | null;
}

export interface AddRepositoryRequest {
  name: string;
  path: string;
}
