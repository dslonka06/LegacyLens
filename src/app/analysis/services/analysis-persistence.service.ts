import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subscription, distinctUntilChanged, filter, map } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { ElectronService } from '@app/core/services/electron.service';
import { Workspace } from '@app/workspace/models/workspace-entity.model';

/**
 * Watches the active workspace for AI result completion and persists them
 * to SQLite via Electron IPC. Runs as a root-level singleton — no component
 * needs to wire this up manually.
 *
 * Saves when both aiExplanation AND securityOverview are present, replacing
 * any prior save for that repository. This avoids partial saves where only
 * one AI field has resolved.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisPersistenceService implements OnDestroy {

  private readonly manager = inject(WorkspaceManagerService);
  private readonly electron = inject(ElectronService);
  private readonly sub: Subscription;

  // Track which analysis records we've already saved this session to avoid
  // re-saving on every workspace$ emission after the first save.
  private readonly saved = new Set<string>();

  constructor() {
    this.sub = this.manager.activeWorkspace$.pipe(
      filter(ws =>
        ws !== null &&
        ws.repositoryId !== null &&
        ws.aiExplanation !== null &&
        ws.securityOverview !== null
      ),
      map(ws => ws!),
      distinctUntilChanged((a, b) =>
        a.id === b.id &&
        a.aiExplanation === b.aiExplanation &&
        a.securityOverview === b.securityOverview
      ),
    ).subscribe(ws => {
      const saveKey = `${ws.id}:${ws.aiExplanation!.generatedAt}`;
      if (this.saved.has(saveKey)) return;
      this.saved.add(saveKey);
      this.saveAiResults(ws.repositoryId!, ws);
    });
  }

  private saveAiResults(repositoryId: string, ws: Workspace): void {
    if (!this.electron.isElectron) return;

    const aiResult = {
      explanation: ws.aiExplanation,
      securityOverview: ws.securityOverview,
      systemUnderstanding: ws.systemUnderstanding ?? null,
      recommendationAnalysis: ws.recommendationAnalysis ?? null,
      learningPathAnalysis: ws.learningPathAnalysis ?? null,
    };

    Promise.all([
      this.electron.getSetting('aiProvider'),
      this.electron.getSetting('aiModel'),
    ]).then(([aiProvider, aiModel]) => {
      return this.electron.saveAnalysis({
        repositoryId,
        scope: ws.type,
        aiResult,
        aiProvider: (aiProvider as string | null) ?? undefined,
        aiModel: (aiModel as string | null) ?? undefined,
      });
    }).catch(() => { /* non-fatal */ });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
