/**
 * Type declarations for window.electronAPI, exposed by electron/preload/preload.js.
 */

export interface ElectronRepository {
  id: string;
  name: string;
  path: string;
  language: string | null;
  framework: string | null;
  gitUrl: string | null;
  gitBranch: string | null;
  addedAt: string;
  lastOpened: string | null;
}

export interface AddRepositoryRequest {
  name: string;
  path: string;
  language?: string;
  framework?: string;
  gitUrl?: string;
  gitBranch?: string;
}

export interface UpdateRepositoryRequest {
  name?: string;
  language?: string;
  framework?: string;
  gitUrl?: string;
  gitBranch?: string;
}

export interface ElectronAnalysis {
  id: string;
  repositoryId: string;
  scope: 'file' | 'folder' | 'repository';
  fileName: string | null;
  createdAt: string;
  aiResult: unknown | null;
  patternResult: unknown | null;
  version: string | null;
  status: 'complete' | 'partial' | string;
  aiProvider: string | null;
  aiModel: string | null;
}

export interface SaveAnalysisRequest {
  repositoryId: string;
  scope: 'file' | 'folder' | 'repository';
  fileName?: string;
  aiResult?: unknown;
  patternResult?: unknown;
  version?: string;
  status?: string;
  aiProvider?: string;
  aiModel?: string;
}

export interface ElectronFileMetadata {
  id: string;
  repositoryId: string;
  relativePath: string;
  extension: string | null;
  size: number | null;
  hash: string | null;
  modifiedAt: string | null;
}

export interface SyncFileEntry {
  relativePath: string;
  extension?: string;
  size?: number;
  hash?: string;
  modifiedAt?: string;
}

export interface ElectronDirectoryEntry {
  name: string;
  relativePath: string;
  /** Full UTF-8 source for readable source files; null for binaries/oversized/non-source files. */
  content: string | null;
  size: number;
  modifiedAt: string;
}

interface ElectronRepositoriesAPI {
  getAll(): Promise<ElectronRepository[]>;
  add(request: AddRepositoryRequest): Promise<ElectronRepository>;
  update(id: string, updates: UpdateRepositoryRequest): Promise<ElectronRepository>;
  touch(id: string): Promise<void>;
  remove(id: string): Promise<boolean>;
}

interface ElectronAnalysisAPI {
  save(data: SaveAnalysisRequest): Promise<ElectronAnalysis>;
  getLatest(repositoryId: string): Promise<ElectronAnalysis | null>;
  getHistory(repositoryId: string): Promise<ElectronAnalysis[]>;
  delete(id: string): Promise<boolean>;
}

interface ElectronFilesAPI {
  sync(repositoryId: string, files: SyncFileEntry[]): Promise<{ upserted: number; unchanged: number }>;
  getAll(repositoryId: string): Promise<ElectronFileMetadata[]>;
  getChanged(repositoryId: string, currentFiles: Array<{ relativePath: string; hash: string }>): Promise<string[]>;
  clearRepository(repositoryId: string): Promise<void>;
}

export interface ScanProgressEvent {
  scanId: string;
  count: number;
  path: string;
}

interface ElectronFilesystemAPI {
  openDialog(options: unknown): Promise<string[] | null>;
  readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[]>;
  cancelScan(scanId: string): Promise<void>;
  readFile(path: string): Promise<string>;
  exportPdf(path: string, content: unknown): Promise<void>;
  /** Registers a scan progress listener. Returns an unsubscribe function. */
  onScanProgress(callback: (event: ScanProgressEvent) => void): () => void;
}

interface ElectronSettingsAPI {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  delete(key: string): Promise<void>;
}

interface ElectronAiAPI {
  explain(prompt: string): Promise<string>;
  analyze(fileName: string, sourceCode: string): Promise<unknown>;
  getProviderUrl(): Promise<string | null>;
  setProviderUrl(url: string | null): Promise<void>;
}

interface ElectronIntelligenceAPI {
  analyzeCode(code: string): Promise<unknown>;
  detectArchitecture(structure: unknown, graph: unknown): Promise<unknown>;
  buildDependencyGraph(sourceFiles: unknown[]): Promise<unknown>;
  exploreDependencies(graph: unknown): Promise<{ hubs: unknown[]; orphans: unknown[]; ranked: unknown[] }>;
  detectTechnologies(files: unknown[]): Promise<unknown[]>;
  discoverProjects(files: unknown[]): Promise<unknown[]>;
  scanRepository(files: unknown[]): Promise<unknown>;
  classifyWorkspace(files: unknown[]): Promise<unknown>;
  systemUnderstanding(session: unknown, knowledge: unknown): Promise<unknown>;
  exploreWorkflows(flows: unknown[]): Promise<unknown[]>;
  learningPath(session: unknown, knowledge: unknown, understanding: unknown, scope: string): Promise<unknown>;
  discoverDataFlows(knowledge: unknown, structure: unknown): Promise<unknown[]>;
  recommendations(session: unknown, knowledge: unknown): Promise<unknown>;
  security(session: unknown, knowledge: unknown): Promise<unknown>;
  insights(knowledge: unknown): Promise<unknown[]>;
  buildSummary(workspaceContext: unknown, knowledge: unknown, session: unknown): Promise<unknown>;
}

interface ElectronAPI {
  repositories: ElectronRepositoriesAPI;
  analysis: ElectronAnalysisAPI;
  files: ElectronFilesAPI;
  filesystem: ElectronFilesystemAPI;
  settings: ElectronSettingsAPI;
  ai: ElectronAiAPI;
  intelligence: ElectronIntelligenceAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
