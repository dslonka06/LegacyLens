import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceManagerService } from './workspace-manager.service';

/**
 * Provides the current AnalysisSession for file-level analysis pages.
 * Sessions are no longer persisted on the Workspace entity — they are held
 * transiently here until the hub page triggers the full knowledge pipeline.
 */
@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  private readonly manager = inject(WorkspaceManagerService);

  private readonly _session$ = new BehaviorSubject<AnalysisSession | null>(null);

  readonly session$: Observable<AnalysisSession | null> = this._session$.asObservable();

  setSession(session: AnalysisSession): void {
    this._session$.next(session);
  }

  getSession(): AnalysisSession | null {
    return this._session$.value;
  }
}
