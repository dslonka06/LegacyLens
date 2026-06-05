import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WorkspaceContext } from '../models/workspace-context.model';
import { WorkspaceProfile } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class CurrentWorkspaceService {

  private readonly _context$ = new BehaviorSubject<WorkspaceContext | null>(null);

  readonly context$ = this._context$.asObservable();

  get context(): WorkspaceContext | null { return this._context$.value; }
  get profile(): WorkspaceProfile | null { return this._context$.value?.profile ?? null; }

  set(profile: WorkspaceProfile, rawFiles: File[]): void {
    const workspaceName = this.deriveName(profile, rawFiles);
    this._context$.next({ profile, uploadedAt: new Date(), workspaceName });
  }

  clear(): void {
    this._context$.next(null);
  }

  private deriveName(profile: WorkspaceProfile, rawFiles: File[]): string {
    // Prefer the root folder name from webkitRelativePath
    for (const file of rawFiles) {
      const rel: string = (file as any).webkitRelativePath ?? '';
      if (rel) {
        const rootFolder = rel.split('/')[0];
        if (rootFolder) return rootFolder;
      }
    }

    // Fall back to the project file name (without extension)
    const projectFile = profile.files.find(f =>
      ['csproj', 'fsproj', 'sln'].includes(f.extension) ||
      f.name.toLowerCase() === 'package.json' ||
      f.name.toLowerCase() === 'angular.json'
    );
    if (projectFile) {
      return projectFile.name.replace(/\.[^.]+$/, '');
    }

    // Last resort: single file name or generic label
    if (profile.totalFiles === 1 && profile.files[0]) {
      return profile.files[0].name;
    }

    return 'Workspace';
  }
}
