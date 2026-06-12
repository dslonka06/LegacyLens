import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { WorkspaceContext } from '../models/workspace-context.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { WorkspaceManagerService } from './workspace-manager.service';
import { ActiveWorkspaceService } from './active-workspace.service';
import { WorkspaceScope } from '../models/modified-file.model';

@Injectable({ providedIn: 'root' })
export class CurrentWorkspaceService {

  // Emits the active scope's context, switching automatically on workspace change.
  readonly context$: Observable<WorkspaceContext | null>;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly activeWorkspace: ActiveWorkspaceService,
  ) {
    this.context$ = this.activeWorkspace.workspace$.pipe(
      switchMap(ws => this.manager.context$(this.toScope(ws))),
    );
  }

  get context(): WorkspaceContext | null {
    return this.manager.getContext(this.activeScope);
  }

  get profile(): WorkspaceProfile | null {
    return this.manager.getContext(this.activeScope)?.profile ?? null;
  }

  set(profile: WorkspaceProfile, rawFiles: File[]): void {
    const workspaceName = this.deriveName(profile, rawFiles);
    this.manager.setContext(this.activeScope, { profile, uploadedAt: new Date(), workspaceName });
  }

  clear(): void {
    this.manager.clearContext(this.activeScope);
  }

  private get activeScope(): WorkspaceScope {
    return this.toScope(this.activeWorkspace.workspace);
  }

  private toScope(ws: string | null): WorkspaceScope {
    if (ws === 'folder')     return 'folder';
    if (ws === 'repository') return 'repository';
    return 'file';
  }

  private deriveName(profile: WorkspaceProfile, rawFiles: File[]): string {
    for (const file of rawFiles) {
      const rel: string = (file as any).webkitRelativePath ?? '';
      if (rel) {
        const rootFolder = rel.split('/')[0];
        if (rootFolder) return rootFolder;
      }
    }

    const projectFile = profile.files.find(f =>
      ['csproj', 'fsproj', 'sln'].includes(f.extension) ||
      f.name.toLowerCase() === 'package.json' ||
      f.name.toLowerCase() === 'angular.json'
    );
    if (projectFile) {
      return projectFile.name.replace(/\.[^.]+$/, '');
    }

    if (profile.totalFiles === 1 && profile.files[0]) {
      return profile.files[0].name;
    }

    return 'Workspace';
  }
}
