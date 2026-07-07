import { Injectable } from '@angular/core';

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Central facade for Electron platform APIs.
 * All access to window.electronAPI goes through here — components never
 * touch window.electronAPI directly.
 *
 * When running in a browser (ng serve without Electron), isElectron is false
 * and native methods return null so the Angular app still loads.
 */
@Injectable({ providedIn: 'root' })
export class ElectronService {

  get isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  private get api() {
    return (window as any).electronAPI ?? null;
  }

  /**
   * Opens a native OS file/folder picker dialog.
   * Returns the selected paths, or null if the user cancelled or not in Electron.
   */
  async openDialog(options?: OpenDialogOptions): Promise<string[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.openDialog(options ?? {});
  }

  /**
   * Convenience: opens a single-folder picker.
   * Returns the selected path string, or null.
   */
  async pickFolder(title = 'Select Folder'): Promise<string | null> {
    const paths = await this.openDialog({
      title,
      properties: ['openDirectory'],
    });
    return paths?.[0] ?? null;
  }

  /**
   * Convenience: opens a single-file picker.
   * Returns the selected path string, or null.
   */
  async pickFile(title = 'Select File', filters?: OpenDialogOptions['filters']): Promise<string | null> {
    const paths = await this.openDialog({
      title,
      properties: ['openFile'],
      filters,
    });
    return paths?.[0] ?? null;
  }
}
