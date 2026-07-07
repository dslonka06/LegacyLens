import { Injectable } from '@angular/core';
import type { ElectronRepository, AddRepositoryRequest, UpdateRepositoryRequest } from '../../../electron';

// Re-export for components that imported from this file
export type { ElectronRepository as Repository, AddRepositoryRequest, UpdateRepositoryRequest };

@Injectable({ providedIn: 'root' })
export class RepositoryLibraryService {

  private get api() {
    return (window as any).electronAPI?.repositories ?? null;
  }

  get isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  async getAll(): Promise<ElectronRepository[]> {
    if (this.api) return this.api.getAll();
    return [];
  }

  async add(request: AddRepositoryRequest): Promise<ElectronRepository> {
    if (this.api) return this.api.add(request);
    // Browser stub for ng serve development
    return {
      id: crypto.randomUUID(),
      name: request.name,
      path: request.path,
      language: request.language ?? null,
      framework: request.framework ?? null,
      gitUrl: request.gitUrl ?? null,
      gitBranch: request.gitBranch ?? null,
      addedAt: new Date().toISOString(),
      lastOpened: null,
    };
  }

  async update(id: string, updates: UpdateRepositoryRequest): Promise<ElectronRepository | null> {
    if (this.api) return this.api.update(id, updates);
    return null;
  }

  async touch(id: string): Promise<void> {
    if (this.api) return this.api.touch(id);
  }

  async remove(id: string): Promise<boolean> {
    if (this.api) return this.api.remove(id);
    return false;
  }
}
