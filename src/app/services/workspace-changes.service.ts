import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModifiedFile, ModifiedFileStatus, WorkspaceScope } from '../models/modified-file.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceChangesService {

  private readonly stores: Record<WorkspaceScope, BehaviorSubject<ModifiedFile[]>> = {
    file:       new BehaviorSubject<ModifiedFile[]>([]),
    folder:     new BehaviorSubject<ModifiedFile[]>([]),
    repository: new BehaviorSubject<ModifiedFile[]>([]),
  };

  changes$(scope: WorkspaceScope): Observable<ModifiedFile[]> {
    return this.stores[scope].asObservable();
  }

  getChanges(scope: WorkspaceScope): ModifiedFile[] {
    return this.stores[scope].getValue();
  }

  saveChange(
    scope: WorkspaceScope,
    filePath: string,
    originalContent: string,
    modifiedContent: string,
    meta?: {
      recommendationId?: string;
      recommendationTitle?: string;
      category?: string;
      severity?: string;
    },
  ): void {
    if (originalContent === modifiedContent) return;

    const current = this.stores[scope].getValue();
    const existing = current.findIndex(f => f.filePath === filePath);
    const fileName = filePath.split('/').pop() ?? filePath;

    const entry: ModifiedFile = {
      id: existing >= 0 ? current[existing].id : this.newId(),
      filePath,
      fileName,
      originalContent,
      modifiedContent,
      modifiedAt: new Date().toISOString(),
      status: 'pending',
      scope,
      ...meta,
    };

    const updated = [...current];
    if (existing >= 0) {
      updated[existing] = entry;
    } else {
      updated.push(entry);
    }
    this.stores[scope].next(updated);
  }

  setStatus(scope: WorkspaceScope, id: string, status: ModifiedFileStatus): void {
    const updated = this.stores[scope].getValue().map(f =>
      f.id === id ? { ...f, status } : f
    );
    this.stores[scope].next(updated);
  }

  setAllStatus(scope: WorkspaceScope, status: ModifiedFileStatus): void {
    const updated = this.stores[scope].getValue().map(f => ({ ...f, status }));
    this.stores[scope].next(updated);
  }

  restore(scope: WorkspaceScope, id: string): void {
    const updated = this.stores[scope].getValue().filter(f => f.id !== id);
    this.stores[scope].next(updated);
  }

  clearScope(scope: WorkspaceScope): void {
    this.stores[scope].next([]);
  }

  isModified(scope: WorkspaceScope, filePath: string): boolean {
    return this.stores[scope].getValue().some(f => f.filePath === filePath);
  }

  getFile(scope: WorkspaceScope, id: string): ModifiedFile | null {
    return this.stores[scope].getValue().find(f => f.id === id) ?? null;
  }

  computeDiff(original: string, modified: string): DiffLine[] {
    const origLines = original.split('\n');
    const modLines  = modified.split('\n');
    const result: DiffLine[] = [];

    // Simple LCS-based line diff
    const lcs = this.buildLcs(origLines, modLines);
    let oi = 0, mi = 0, li = 0;

    while (oi < origLines.length || mi < modLines.length) {
      if (li < lcs.length && oi < origLines.length && mi < modLines.length
          && origLines[oi] === lcs[li] && modLines[mi] === lcs[li]) {
        result.push({ type: 'unchanged', content: origLines[oi], lineOrig: oi + 1, lineMod: mi + 1 });
        oi++; mi++; li++;
      } else if (mi < modLines.length && (li >= lcs.length || modLines[mi] !== lcs[li])) {
        result.push({ type: 'added', content: modLines[mi], lineMod: mi + 1 });
        mi++;
      } else {
        result.push({ type: 'removed', content: origLines[oi], lineOrig: oi + 1 });
        oi++;
      }
    }
    return result;
  }

  private buildLcs(a: string[], b: string[]): string[] {
    // Cap at 2000 lines each to keep O(n*m) manageable
    const A = a.slice(0, 2000);
    const B = b.slice(0, 2000);
    const m = A.length, n = B.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const lcs: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (A[i - 1] === B[j - 1]) { lcs.unshift(A[i - 1]); i--; j--; }
      else if (dp[i - 1][j] > dp[i][j - 1]) { i--; } else { j--; }
    }
    return lcs;
  }

  private newId(): string {
    return `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineOrig?: number;
  lineMod?: number;
}
