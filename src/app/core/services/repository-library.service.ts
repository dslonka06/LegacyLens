import { Injectable } from '@angular/core';

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

/**
 * Angular facade over the Electron RepositoryLibraryService.
 * When running inside Electron, delegates to window.electronAPI.repositories.
 * When running in the browser (ng serve without Electron), falls back to an
 * in-memory stub so development remains uninterrupted.
 */
@Injectable({ providedIn: 'root' })
export class RepositoryLibraryService {

  private get api() {
    return (window as any).electronAPI?.repositories ?? null;
  }

  async getAll(): Promise<Repository[]> {
    if (this.api) {
      return this.api.getAll();
    }
    return [];
  }

  async add(request: AddRepositoryRequest): Promise<Repository> {
    if (this.api) {
      return this.api.add(request);
    }
    // Browser stub: return a mock so UI development works without Electron
    return {
      id: crypto.randomUUID(),
      name: request.name,
      path: request.path,
      addedAt: new Date().toISOString(),
      lastOpenedAt: null,
    };
  }

  async remove(id: string): Promise<boolean> {
    if (this.api) {
      return this.api.remove(id);
    }
    return false;
  }

  /** Returns true when running inside Electron (IPC is available). */
  get isElectron(): boolean {
    return !!(window as any).electronAPI;
  }
}
