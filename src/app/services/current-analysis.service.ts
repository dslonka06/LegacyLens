import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceManagerService } from './workspace-manager.service';
import { ActiveWorkspaceService } from './active-workspace.service';
import { WorkspaceScope } from '../models/modified-file.model';

@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  // Emits the active scope's session, switching automatically on workspace change.
  readonly session$: Observable<AnalysisSession | null>;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly activeWorkspace: ActiveWorkspaceService,
  ) {
    this.session$ = this.activeWorkspace.workspace$.pipe(
      switchMap(ws => this.manager.session$(this.toScope(ws))),
    );
  }

  setSession(session: AnalysisSession): void {
    this.manager.setSession(session.scope, session);
  }

  getSession(): AnalysisSession | null {
    return this.manager.getSession(this.activeScope);
  }

  private get activeScope(): WorkspaceScope {
    return this.toScope(this.activeWorkspace.workspace);
  }

  private toScope(ws: string | null): WorkspaceScope {
    if (ws === 'folder')     return 'folder';
    if (ws === 'repository') return 'repository';
    return 'file';
  }
}
