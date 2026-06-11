import { Injectable } from '@angular/core';
import { AnalysisType, HistoryEntry } from '../models/history-entry.model';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceContext } from '../models/workspace-context.model';

const STORAGE_KEY = 'legacylens-history-v2';
const MAX_ENTRIES = 100;

@Injectable({ providedIn: 'root' })
export class HistoryService {

  addFileEntry(session: AnalysisSession): void {
    this.push({
      id: this.newId(),
      analysisType: 'file',
      name: session.fileName,
      createdAt: session.createdAt,
      language: session.analysis.language,
    });
  }

  addFolderEntry(context: WorkspaceContext, session: AnalysisSession): void {
    this.push({
      id: this.newId(),
      analysisType: 'folder',
      name: context.workspaceName,
      createdAt: session.createdAt,
      language: session.analysis.language,
      fileCount: context.profile.totalFiles,
    });
  }

  addRepositoryEntry(context: WorkspaceContext, session: AnalysisSession): void {
    this.push({
      id: this.newId(),
      analysisType: 'repository',
      name: context.workspaceName,
      createdAt: session.createdAt,
      language: context.profile.languages[0],
      fileCount: context.profile.totalFiles,
    });
  }

  getEntries(): HistoryEntry[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as HistoryEntry[];
    } catch {
      return [];
    }
  }

  deleteEntry(id: string): void {
    const entries = this.getEntries().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private push(entry: HistoryEntry): void {
    const entries = this.getEntries();
    entries.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  }

  private newId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
