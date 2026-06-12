import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ModifiedFile, ModifiedFileStatus } from '../models/modified-file.model';
import { WorkspaceManagerService } from './workspace-manager.service';

// Kept as a thin facade over WorkspaceManagerService so all existing page
// consumers can continue calling the same API without modification.
@Injectable({ providedIn: 'root' })
export class WorkspaceChangesService {

  constructor(private readonly manager: WorkspaceManagerService) {}

  changes$(workspaceId: string): Observable<ModifiedFile[]> {
    return this.manager.changes$(workspaceId);
  }

  getChanges(workspaceId: string): ModifiedFile[] {
    return this.manager.getChanges(workspaceId);
  }

  saveChange(
    workspaceId: string,
    filePath: string,
    originalContent: string,
    modifiedContent: string,
    meta?: { recommendationId?: string; recommendationTitle?: string; category?: string; severity?: string },
  ): void {
    this.manager.saveChange(workspaceId, filePath, originalContent, modifiedContent, meta);
  }

  setStatus(workspaceId: string, changeId: string, status: ModifiedFileStatus): void {
    this.manager.setChangeStatus(workspaceId, changeId, status);
  }

  setAllStatus(workspaceId: string, status: ModifiedFileStatus): void {
    this.manager.setAllChangeStatus(workspaceId, status);
  }

  restore(workspaceId: string, changeId: string): void {
    this.manager.restoreChange(workspaceId, changeId);
  }

  isModified(workspaceId: string, filePath: string): boolean {
    return this.manager.isFileModified(workspaceId, filePath);
  }

  getFile(workspaceId: string, changeId: string): ModifiedFile | null {
    return this.manager.getChange(workspaceId, changeId);
  }

  computeDiff(original: string, modified: string): DiffLine[] {
    const origLines = original.split('\n');
    const modLines  = modified.split('\n');
    const result: DiffLine[] = [];
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
    const A = a.slice(0, 2000);
    const B = b.slice(0, 2000);
    const m = A.length, n = B.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = A[i - 1] === B[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
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
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineOrig?: number;
  lineMod?: number;
}
