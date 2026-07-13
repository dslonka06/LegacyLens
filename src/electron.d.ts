/**
 * Type declarations for window.electronAPI, exposed by electron/preload/preload.js.
 *
 * KnowledgeModel is the canonical contract — defined once in knowledge-model.contract.ts
 * and re-exported here so IPC consumers use the same type as everything else.
 */

export type {
  KnowledgeModel,
  KnowledgeCapability,
  KnowledgeAIResults,
  KnowledgeMetadata,
  KnowledgeStructure,
  KnowledgeRelationships,
  KnowledgeInsights,
  AnalysisTargetType,
  AIStage,
  SymbolSummary,
  DependencyHub,
  FileRanking,
  ArchitecturePattern,
  DataFlowInsight,
  RiskInsight,
} from '@app/knowledge/models/knowledge-model.contract';

// ── Repository library ─────────────────────────────────────────────────────────

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

// ── Analysis records ───────────────────────────────────────────────────────────

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

// ── File metadata ──────────────────────────────────────────────────────────────

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

export interface ScanProgressEvent {
  scanId: string;
  count: number;
  path: string;
}

// ── Intelligence: workspace processing ────────────────────────────────────────

export interface ProcessWorkspaceRequest {
  targetType: import('@app/knowledge/models/knowledge-model.contract').AnalysisTargetType;
  files: Array<{ name: string; path: string; extension: string; content: string | null }>;
  options?: {
    repositoryId?: string;
    repositoryPath?: string;
    workspaceName?: string;
    persist?: boolean;
    incremental?: boolean;
  };
}

export interface IncrementalCheckResult {
  needsFullRebuild: boolean;
  needsPartialRebuild: boolean;
  changedPaths: string[];
  reason: string;
  existingModel: import('@app/knowledge/models/knowledge-model.contract').KnowledgeModel | null;
}

export interface BuildKnowledgeModelOptions {
  repositoryPath?: string;
  workspaceName?: string;
  repositoryId?: string;
  persist?: boolean;
}

export interface PipelineResult {
  targetType: import('@app/knowledge/models/knowledge-model.contract').AnalysisTargetType;
  plannedCapabilities: string[];
  executedCapabilities: string[];
  capabilityErrors: Record<string, string>;
  parsedFiles: unknown[];
  languages: string[];
  detectedTechnologies: unknown[];
  frameworks: string[];
  symbolIndex: Record<string, unknown>;
  folderStructure: unknown | null;
  dependencyGraph: unknown | null;
  dependencyHubs: unknown[];
  dependencyRanks: unknown[];
  projects: unknown[];
  gitAnalysis: { available: boolean; reason: string } | null;
  architectureHints: string[] | null;
}

// ── API surface declarations ───────────────────────────────────────────────────

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
  sync(
    repositoryId: string,
    files: SyncFileEntry[],
  ): Promise<{ upserted: number; unchanged: number }>;
  getAll(repositoryId: string): Promise<ElectronFileMetadata[]>;
  getChanged(
    repositoryId: string,
    currentFiles: Array<{ relativePath: string; hash: string }>,
  ): Promise<string[]>;
  clearRepository(repositoryId: string): Promise<void>;
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

type _KM = import('@app/knowledge/models/knowledge-model.contract').KnowledgeModel;
type _AT = import('@app/knowledge/models/knowledge-model.contract').AnalysisTargetType;

interface ElectronIntelligenceAPI {
  // ── Legacy single-file analysis (still used by file hub during transition) ──
  analyzeCode(code: string): Promise<unknown>;

  // ── Individual capabilities (used by legacy pages; being phased out) ─────────
  detectArchitecture(structure: unknown, graph: unknown): Promise<unknown>;
  buildDependencyGraph(sourceFiles: unknown[]): Promise<unknown>;
  exploreDependencies(
    graph: unknown,
  ): Promise<{ hubs: unknown[]; orphans: unknown[]; ranked: unknown[] }>;
  detectTechnologies(files: unknown[]): Promise<unknown[]>;
  discoverProjects(files: unknown[]): Promise<unknown[]>;
  scanRepository(files: unknown[]): Promise<unknown>;
  classifyWorkspace(files: unknown[]): Promise<unknown>;
  exploreWorkflows(flows: unknown[]): Promise<unknown[]>;
  discoverDataFlows(knowledge: unknown, structure: unknown): Promise<unknown[]>;
  insights(knowledge: unknown): Promise<unknown[]>;
  buildSummary(workspaceContext: unknown, knowledge: unknown, session: unknown): Promise<unknown>;

  // ── AI analysis — accept KnowledgeModel, return typed result ─────────────────
  systemUnderstanding(model: _KM): Promise<unknown>;
  learningPath(model: _KM): Promise<unknown>;
  recommendations(model: _KM): Promise<unknown>;
  security(model: _KM): Promise<unknown>;

  // ── D2/D3 pipeline ────────────────────────────────────────────────────────────
  runPipeline(targetType: _AT, files: unknown[]): Promise<PipelineResult>;
  capabilitiesFor(targetType: _AT): Promise<string[]>;

  // ── D4 model build ────────────────────────────────────────────────────────────
  buildKnowledgeModel(
    targetType: _AT,
    files: unknown[],
    options?: BuildKnowledgeModelOptions,
  ): Promise<_KM>;
  getKnowledgeModel(repositoryId: string): Promise<_KM | null>;

  // ── D5 context generation ─────────────────────────────────────────────────────
  buildContext(
    contextType: 'repository' | 'workflow' | 'security' | 'analysis',
    knowledgeModel: _KM,
    extras?: unknown,
  ): Promise<unknown>;

  // ── D6 incremental check ──────────────────────────────────────────────────────
  checkIncremental(
    repositoryId: string,
    currentFiles: Array<{ relativePath: string; hash: string }>,
    targetType: _AT,
  ): Promise<IncrementalCheckResult>;

  // ── D7 unified workspace processing ──────────────────────────────────────────
  processWorkspace(request: ProcessWorkspaceRequest): Promise<_KM>;
}

interface ElectronValidationAPI {
  detectTarget(
    targetPath: string,
  ): Promise<{ path: string; detected: 'file' | 'folder' | 'repository' | 'unknown' | 'invalid' }>;
}

// ── Workspace persistence ──────────────────────────────────────────────────────

export interface PersistedWorkspace {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'repository';
  status: 'empty' | 'processing' | 'ready' | 'failed' | 'error';
  createdAt: string;
  lastModifiedAt: string;
  repositoryId: string | null;
  knowledgeModel: import('@app/knowledge/models/knowledge-model.contract').KnowledgeModel | null;
}

interface ElectronWorkspacesAPI {
  getAll(): Promise<PersistedWorkspace[]>;
  save(workspace: PersistedWorkspace): Promise<PersistedWorkspace>;
  delete(id: string): Promise<boolean>;
}

// ── Auto-updater ───────────────────────────────────────────────────────────────

export interface UpdateAvailablePayload {
  version: string;
  releaseNotes: string | null;
}

export interface DownloadProgressPayload {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateDownloadedPayload {
  version: string;
}

interface ElectronUpdaterAPI {
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installAndRestart(): Promise<void>;
  onUpdateAvailable(cb: (payload: UpdateAvailablePayload) => void): () => void;
  onUpdateNotAvailable(cb: (payload: Record<string, never>) => void): () => void;
  onDownloadProgress(cb: (payload: DownloadProgressPayload) => void): () => void;
  onUpdateDownloaded(cb: (payload: UpdateDownloadedPayload) => void): () => void;
}

interface ElectronAPI {
  repositories: ElectronRepositoriesAPI;
  analysis: ElectronAnalysisAPI;
  files: ElectronFilesAPI;
  filesystem: ElectronFilesystemAPI;
  settings: ElectronSettingsAPI;
  ai: ElectronAiAPI;
  intelligence: ElectronIntelligenceAPI;
  validation: ElectronValidationAPI;
  workspaces: ElectronWorkspacesAPI;
  updater: ElectronUpdaterAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
