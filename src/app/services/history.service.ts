import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';

const STORAGE_KEY = 'legacylens-history';

@Injectable({ providedIn: 'root' })
export class HistoryService {

  addSession(session: AnalysisSession): void {
    const sessions = this.getSessions();
    sessions.unshift(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  getSessions(): AnalysisSession[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as AnalysisSession[];
    } catch {
      return [];
    }
  }

  getSessionByIndex(index: number): AnalysisSession | null {
    const sessions = this.getSessions();
    return sessions[index] ?? null;
  }

  deleteSession(index: number): void {
    const sessions = this.getSessions();
    sessions.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  getMostRecent(): AnalysisSession | null {
    const sessions = this.getSessions();
    return sessions[0] ?? null;
  }
}
