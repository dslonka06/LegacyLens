/**
 * Type declarations for window.electronAPI, exposed by electron/preload/preload.js.
 * These types mirror the shape defined in the preload's contextBridge.exposeInMainWorld call.
 */

import type { Repository, AddRepositoryRequest } from './app/core/services/repository-library.service';

interface ElectronRepositoriesAPI {
  getAll(): Promise<Repository[]>;
  add(request: AddRepositoryRequest): Promise<Repository>;
  remove(id: string): Promise<boolean>;
}

interface ElectronWorkspaceAPI {
  create(type: string): Promise<unknown>;
  activate(id: string): Promise<unknown>;
  delete(id: string): Promise<unknown>;
  getAll(): Promise<unknown[]>;
}

interface ElectronAnalysisAPI {
  run(workspaceId: string, options: unknown): Promise<unknown>;
  getResult(workspaceId: string): Promise<unknown>;
}

interface ElectronFilesystemAPI {
  readFile(path: string): Promise<string>;
  exportPdf(path: string, content: unknown): Promise<void>;
  openDialog(options: unknown): Promise<string | null>;
}

interface ElectronSettingsAPI {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

interface ElectronAPI {
  repositories: ElectronRepositoriesAPI;
  workspace: ElectronWorkspaceAPI;
  analysis: ElectronAnalysisAPI;
  filesystem: ElectronFilesystemAPI;
  settings: ElectronSettingsAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
