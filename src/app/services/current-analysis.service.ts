import { Injectable } from '@angular/core';
import { Observable, switchMap, of, map } from 'rxjs';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceManagerService } from './workspace-manager.service';

@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  readonly session$: Observable<AnalysisSession | null> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.session ?? null),
  );

  constructor(private readonly manager: WorkspaceManagerService) {}

  setSession(session: AnalysisSession): void {
    const id = this.manager.activeId;
    if (id) this.manager.setSession(id, session);
  }

  getSession(): AnalysisSession | null {
    return this.manager.getActive()?.session ?? null;
  }
}
