import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WorkspaceContext } from '../models/workspace-context.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { WorkspaceManagerService } from './workspace-manager.service';

/**
 * Provides the WorkspaceContext (profile + name) for the active workspace.
 * Context is held transiently in memory — it is derived from uploaded files
 * and not persisted on the Workspace entity.
 */
@Injectable({ providedIn: 'root' })
export class CurrentWorkspaceService {
  private readonly manager = inject(WorkspaceManagerService);

  private readonly _context$ = new BehaviorSubject<WorkspaceContext | null>(null);

  readonly context$: Observable<WorkspaceContext | null> = this._context$.asObservable();

  get context(): WorkspaceContext | null {
    return this._context$.value;
  }

  get profile(): WorkspaceProfile | null {
    return this._context$.value?.profile ?? null;
  }

  get uploadedFiles(): File[] {
    const id = this.manager.activeId;
    return id ? this.manager.getRawFiles(id) : [];
  }

  set(profile: WorkspaceProfile, rawFiles: File[]): void {
    const id = this.manager.activeId;
    if (!id) return;
    this.manager.setRawFiles(id, rawFiles);
    const workspaceName = this.deriveName(profile, rawFiles);
    this._context$.next({ profile, uploadedAt: new Date(), workspaceName });
  }

  clear(): void {
    const id = this.manager.activeId;
    if (id) {
      this.manager.clearRawFiles(id);
    }
    this._context$.next(null);
  }

  private deriveName(profile: WorkspaceProfile, rawFiles: File[]): string {
    for (const file of rawFiles) {
      const rel: string = (file as any).webkitRelativePath ?? '';
      if (rel) {
        const rootFolder = rel.split('/')[0];
        if (rootFolder) return rootFolder;
      }
    }
    const projectFile = profile.files.find(
      (f) =>
        ['csproj', 'fsproj', 'sln'].includes(f.extension) ||
        f.name.toLowerCase() === 'package.json' ||
        f.name.toLowerCase() === 'angular.json',
    );
    if (projectFile) return projectFile.name.replace(/\.[^.]+$/, '');
    if (profile.totalFiles === 1 && profile.files[0]) return profile.files[0].name;
    return 'Workspace';
  }
}
