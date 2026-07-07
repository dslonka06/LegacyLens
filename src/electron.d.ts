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
}

export interface SaveAnalysisRequest {
  repositoryId: string;
  scope: 'file' | 'folder' | 'repository';
  fileName?: string;
  aiResult?: unknown;
  patternResult?: unknown;
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

interface ElectronFilesystemAPI {
  openDialog(options: unknown): Promise<string[] | null>;
  readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[]>;
  readFile(path: string): Promise<string>;
  exportPdf(path: string, content: unknown): Promise<void>;
}

interface ElectronSettingsAPI {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  delete(key: string): Promise<void>;
}

interface ElectronAPI {
  repositories: ElectronRepositoriesAPI;
  analysis: ElectronAnalysisAPI;
  files: ElectronFilesAPI;
  filesystem: ElectronFilesystemAPI;
  settings: ElectronSettingsAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
