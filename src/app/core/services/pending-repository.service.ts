import { Injectable } from '@angular/core';

/**
 * Temporary bridge between the Repository Library (home page) and the
 * Repository Analysis page. When the user clicks "Open" on a saved repo,
 * the home page stores the folder path here before navigating. The analysis
 * page reads and clears it on init, then loads the files from disk.
 *
 * This is intentionally minimal — it holds state only for the duration of
 * a single navigation, not across sessions.
 */
@Injectable({ providedIn: 'root' })
export class PendingRepositoryService {
  private _path: string | null = null;
  private _repositoryId: string | null = null;

  set(path: string, repositoryId: string): void {
    this._path = path;
    this._repositoryId = repositoryId;
  }

  consume(): { path: string; repositoryId: string } | null {
    if (!this._path || !this._repositoryId) return null;
    const result = { path: this._path, repositoryId: this._repositoryId };
    this._path = null;
    this._repositoryId = null;
    return result;
  }
}
