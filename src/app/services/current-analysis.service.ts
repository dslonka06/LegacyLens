import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';

@Injectable({ providedIn: 'root' })
export class CurrentAnalysisService {

  private session: AnalysisSession | null = null;

  setSession(session: AnalysisSession): void {
    this.session = session;
  }

  getSession(): AnalysisSession | null {
    return this.session;
  }
}
