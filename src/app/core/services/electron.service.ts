import { Injectable } from '@angular/core';
// Types come from src/electron.d.ts which is picked up globally by tsconfig
import type {
  ElectronRepository,
  AddRepositoryRequest,
  UpdateRepositoryRequest,
  ElectronAnalysis,
  SaveAnalysisRequest,
  ElectronFileMetadata,
  SyncFileEntry,
  ElectronDirectoryEntry,
} from '../../../electron';

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
  filters?: Array<{ name: string; extensions: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class ElectronService {

  get isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  private get api() {
    return (window as any).electronAPI ?? null;
  }

  // ── Repositories ──────────────────────────────────────────────────────────

  async getRepositories(): Promise<ElectronRepository[]> {
    if (!this.api) return [];
    return this.api.repositories.getAll();
  }

  async addRepository(request: AddRepositoryRequest): Promise<ElectronRepository | null> {
    if (!this.api) return null;
    return this.api.repositories.add(request);
  }

  async updateRepository(id: string, updates: UpdateRepositoryRequest): Promise<ElectronRepository | null> {
    if (!this.api) return null;
    return this.api.repositories.update(id, updates);
  }

  async touchRepository(id: string): Promise<void> {
    if (!this.api) return;
    return this.api.repositories.touch(id);
  }

  async removeRepository(id: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.repositories.remove(id);
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  async saveAnalysis(data: SaveAnalysisRequest): Promise<ElectronAnalysis | null> {
    if (!this.api) return null;
    return this.api.analysis.save(data);
  }

  async getLatestAnalysis(repositoryId: string): Promise<ElectronAnalysis | null> {
    if (!this.api) return null;
    return this.api.analysis.getLatest(repositoryId);
  }

  async getAnalysisHistory(repositoryId: string): Promise<ElectronAnalysis[]> {
    if (!this.api) return [];
    return this.api.analysis.getHistory(repositoryId);
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.analysis.delete(id);
  }

  // ── File Metadata ─────────────────────────────────────────────────────────

  async syncFileMetadata(repositoryId: string, files: SyncFileEntry[]): Promise<{ upserted: number; unchanged: number } | null> {
    if (!this.api) return null;
    return this.api.files.sync(repositoryId, files);
  }

  async getFileMetadata(repositoryId: string): Promise<ElectronFileMetadata[]> {
    if (!this.api) return [];
    return this.api.files.getAll(repositoryId);
  }

  async getChangedFiles(repositoryId: string, currentFiles: Array<{ relativePath: string; hash: string }>): Promise<string[]> {
    if (!this.api) return [];
    return this.api.files.getChanged(repositoryId, currentFiles);
  }

  // ── Filesystem ────────────────────────────────────────────────────────────

  async openDialog(options?: OpenDialogOptions): Promise<string[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.openDialog(options ?? {});
  }

  async pickFolder(title = 'Select Folder'): Promise<string | null> {
    const paths = await this.openDialog({ title, properties: ['openDirectory'] });
    return paths?.[0] ?? null;
  }

  async pickFile(title = 'Select File', filters?: OpenDialogOptions['filters']): Promise<string | null> {
    const paths = await this.openDialog({ title, properties: ['openFile'], filters });
    return paths?.[0] ?? null;
  }

  async readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.readDirectory(dirPath);
  }

  async pickAndReadFolder(title = 'Select Folder'): Promise<{ folderPath: string; files: ElectronDirectoryEntry[] } | null> {
    const folderPath = await this.pickFolder(title);
    if (!folderPath) return null;
    const files = await this.readDirectory(folderPath);
    if (!files) return null;
    return { folderPath, files };
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.settings.get(key);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    if (!this.api) return;
    return this.api.settings.set(key, value);
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    if (!this.api) return {};
    return this.api.settings.getAll();
  }
}
