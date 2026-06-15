import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceManagerService } from './workspace-manager.service';

@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  private readonly manager = inject(WorkspaceManagerService);

  readonly session$: Observable<AnalysisSession | null> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.session ?? null),
  );

  setSession(session: AnalysisSession): void {
    const id = this.manager.activeId;
    if (id) this.manager.setSession(id, session);
  }

  getSession(): AnalysisSession | null {
    return this.manager.getActive()?.session ?? null;
  }
}
