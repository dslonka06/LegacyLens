import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnalysisSession } from '../models/analysis-session.model';

@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  private readonly sessionSubject = new BehaviorSubject<AnalysisSession | null>(null);

  readonly session$: Observable<AnalysisSession | null> = this.sessionSubject.asObservable();

  setSession(session: AnalysisSession): void {
    this.sessionSubject.next(session);
  }

  getSession(): AnalysisSession | null {
    return this.sessionSubject.getValue();
  }
}
