import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  map,
  distinctUntilChanged,
  switchMap,
  of,
} from 'rxjs';
import { Router } from '@angular/router';
import {
  Workspace,
  WorkspaceType,
  WorkspaceStatus,
  MAX_WORKSPACES,
} from '../models/workspace-entity.model';
import type {
  KnowledgeModel,
  KnowledgeAIResults,
  AIStage,
} from '@app/knowledge/models/knowledge-model.contract';
import { ElectronService } from '@app/core/services/electron.service';
import type { PersistedWorkspace } from '../../../electron';

@Injectable({ providedIn: 'root' })
export class WorkspaceManagerService {
  private readonly _workspaces$ = new BehaviorSubject<Workspace[]>([]);
  private readonly _activeId$ = new BehaviorSubject<string | null>(null);

  // Raw File[] objects keyed by workspace ID — not serializable so kept separate
  // from the Workspace entity. Survives multi-workspace navigation.
  private readonly _rawFiles = new Map<string, File[]>();

  // Debounce timers keyed by workspace ID — prevents a SQLite write on every AI stage merge.
  private readonly _saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Active AI stages per workspace — shown in the workspace panel during analysis.
  private readonly _activeStages$ = new BehaviorSubject<Map<string, Set<AIStage>>>(new Map());
  readonly activeStages$ = this._activeStages$.asObservable();

  // Generation counter per workspace — incremented on re-analyze/cancel so stale AI
  // results arriving after a new pipeline started are discarded.
  private readonly _generations = new Map<string, number>();

  readonly workspaces$ = this._workspaces$.asObservable();
  readonly activeId$ = this._activeId$.asObservable();

  // Emits when auto-create is blocked by the workspace limit — subscribers
  // (analysis pages) can open the switcher modal in response.
  private readonly _limitReached$ = new Subject<void>();
  readonly limitReached$ = this._limitReached$.asObservable();

  readonly activeWorkspace$: Observable<Workspace | null> = this._activeId$.pipe(
    switchMap((id) =>
      id ? this._workspaces$.pipe(map((ws) => ws.find((w) => w.id === id) ?? null)) : of(null),
    ),
    distinctUntilChanged(),
  );

  constructor(
    private readonly router: Router,
    private readonly electronService: ElectronService,
  ) {
    this.restoreFromStorage();
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  get workspaces(): Workspace[] {
    return this._workspaces$.value;
  }
  get activeId(): string | null {
    return this._activeId$.value;
  }

  getActive(): Workspace | null {
    const id = this._activeId$.value;
    return id ? (this._workspaces$.value.find((w) => w.id === id) ?? null) : null;
  }

  getById(id: string): Workspace | null {
    return this._workspaces$.value.find((w) => w.id === id) ?? null;
  }

  getByType(type: WorkspaceType): Workspace[] {
    return this._workspaces$.value.filter((w) => w.type === type);
  }

  canCreate(): boolean {
    return this._workspaces$.value.length < MAX_WORKSPACES;
  }

  workspace$(id: string): Observable<Workspace | null> {
    return this._workspaces$.pipe(
      map((ws) => ws.find((w) => w.id === id) ?? null),
      distinctUntilChanged(),
    );
  }

  // ── Creation ──────────────────────────────────────────────────────────────

  create(type: WorkspaceType, name?: string): Workspace {
    const id = this.generateId();
    const now = new Date().toISOString();
    const defaultName =
      type === 'file'
        ? 'File Workspace'
        : type === 'folder'
          ? 'Folder Workspace'
          : 'Repository Workspace';

    const ws: Workspace = {
      id,
      name: name ?? defaultName,
      type,
      status: 'empty',
      createdAt: now,
      lastModifiedAt: now,
      repositoryId: null,
      knowledgeModel: null,
    };

    this._workspaces$.next([...this._workspaces$.value, ws]);
    this._activeId$.next(id);
    this.scheduleSave(ws);
    return ws;
  }

  // ── Activation ────────────────────────────────────────────────────────────

  activate(id: string): void {
    const ws = this.getById(id);
    if (!ws) return;
    this._activeId$.next(id);
    this.router.navigate([this.routeForType(ws.type)]);
  }

  // Called by navigation guard — sets active to the first workspace of that
  // type if one exists, or creates a blank one. Returns null if limit reached.
  activateOrCreateForType(type: WorkspaceType): Workspace | null {
    const existing = this.getByType(type);
    if (existing.length > 0) {
      const current = this.getActive();
      const target = current?.type === type ? current : existing[0];
      this._activeId$.next(target.id);
      return target;
    }
    if (!this.canCreate()) {
      this._limitReached$.next();
      return null;
    }
    return this.create(type);
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  rename(id: string, name: string): void {
    this.patch(id, { name, lastModifiedAt: new Date().toISOString() });
  }

  // ── Deletion ─────────────────────────────────────────────────────────────

  delete(id: string): void {
    this._rawFiles.delete(id);

    const timer = this._saveTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this._saveTimers.delete(id);
    }

    const remaining = this._workspaces$.value.filter((w) => w.id !== id);
    this._workspaces$.next(remaining);
    this.electronService.deleteWorkspace(id);

    if (this._activeId$.value === id) {
      if (remaining.length > 0) {
        const next = remaining[remaining.length - 1];
        this._activeId$.next(next.id);
        this.router.navigate([this.routeForType(next.type)]);
      } else {
        this._activeId$.next(null);
        this.router.navigate(['/']);
      }
    }
  }

  // ── Repository link ───────────────────────────────────────────────────────

  setRepositoryId(id: string, repositoryId: string): void {
    this.patch(id, { repositoryId });
  }

  // ── Knowledge Model ───────────────────────────────────────────────────────
  // These are the ONLY mutation points for knowledgeModel. Called exclusively
  // by WorkspaceKnowledgeService — nothing else should call these directly.

  /** Set the structural KnowledgeModel after the Code Intelligence Engine completes. */
  setKnowledgeModel(id: string, model: KnowledgeModel): void {
    this.patch(id, {
      knowledgeModel: model,
      status: 'ready',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  /** Mark the workspace as processing (structural pipeline running). */
  setProcessing(id: string): void {
    this.patch(id, { status: 'processing', lastModifiedAt: new Date().toISOString() });
  }

  /** Mark the workspace as failed. */
  setError(id: string): void {
    this.patch(id, { status: 'error', lastModifiedAt: new Date().toISOString() });
  }

  /**
   * Merge AI results into the existing KnowledgeModel.
   * Partial merge — only updates the fields present in `aiResults`.
   * Called by AIAnalysisService as each AI stage completes.
   *
   * @param generation  If provided, the result is dropped if the workspace has moved on.
   */
  mergeAIResults(id: string, aiResults: Partial<KnowledgeAIResults>, generation?: number): void {
    if (generation !== undefined && this.getGeneration(id) !== generation) return;
    const ws = this.getById(id);
    if (!ws?.knowledgeModel) return;

    const existing = ws.knowledgeModel.ai ?? { completedStages: [], failedStages: [] };
    const merged: KnowledgeAIResults = { ...existing, ...aiResults };

    this.patch(id, {
      knowledgeModel: { ...ws.knowledgeModel, ai: merged },
      lastModifiedAt: new Date().toISOString(),
    });
  }

  /** Mark an AI stage as failed without losing other AI results. */
  markAIStageFailed(id: string, stage: AIStage, generation?: number, errorMessage?: string): void {
    if (generation !== undefined && this.getGeneration(id) !== generation) return;
    const ws = this.getById(id);
    if (!ws?.knowledgeModel) return;

    const existing = ws.knowledgeModel.ai ?? { completedStages: [], failedStages: [] };
    const failedStages = [...new Set([...existing.failedStages, stage])];
    const stageErrors = errorMessage
      ? { ...(existing.stageErrors ?? {}), [stage]: errorMessage }
      : existing.stageErrors;

    this.patch(id, {
      knowledgeModel: {
        ...ws.knowledgeModel,
        ai: { ...existing, failedStages, stageErrors },
      },
    });
  }

  clearKnowledgeModel(id: string): void {
    this.patch(id, {
      knowledgeModel: null,
      status: 'empty',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  // ── AI stage progress ─────────────────────────────────────────────────────

  setStageRunning(workspaceId: string, stage: AIStage): void {
    const current = new Map(this._activeStages$.value);
    const stages = new Set(current.get(workspaceId) ?? []);
    stages.add(stage);
    current.set(workspaceId, stages);
    this._activeStages$.next(current);
  }

  clearStageRunning(workspaceId: string, stage: AIStage): void {
    const current = new Map(this._activeStages$.value);
    const stages = new Set(current.get(workspaceId) ?? []);
    stages.delete(stage);
    if (stages.size === 0) {
      current.delete(workspaceId);
    } else {
      current.set(workspaceId, stages);
    }
    this._activeStages$.next(current);
  }

  clearAllStages(workspaceId: string): void {
    const current = new Map(this._activeStages$.value);
    current.delete(workspaceId);
    this._activeStages$.next(current);
  }

  getActiveStages(workspaceId: string): Set<AIStage> {
    return new Set(this._activeStages$.value.get(workspaceId) ?? []);
  }

  // ── Generation (cancellation) ─────────────────────────────────────────────

  /** Returns the current generation for a workspace. 0 if never started. */
  getGeneration(id: string): number {
    return this._generations.get(id) ?? 0;
  }

  /** Increments and returns the new generation. Called by WorkspaceKnowledgeService on (re-)analyze. */
  nextGeneration(id: string): number {
    const next = (this._generations.get(id) ?? 0) + 1;
    this._generations.set(id, next);
    return next;
  }

  // ── Raw file storage ──────────────────────────────────────────────────────
  // Kept separate from the Workspace entity — File objects are not serializable.

  setRawFiles(id: string, files: File[]): void {
    this._rawFiles.set(id, files);
  }
  getRawFiles(id: string): File[] {
    return this._rawFiles.get(id) ?? [];
  }
  clearRawFiles(id: string): void {
    this._rawFiles.delete(id);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private async restoreFromStorage(): Promise<void> {
    if (!this.electronService.isElectron) return;
    try {
      const persisted = await this.electronService.getPersistedWorkspaces();
      if (persisted.length === 0) return;

      const restored: Workspace[] = persisted.map((p) => {
        // processing means the app closed mid-analysis — mark as failed so the
        // UI can show a recovery prompt rather than pretending nothing happened.
        const status: WorkspaceStatus = p.knowledgeModel
          ? 'ready'
          : p.status === 'processing'
            ? 'failed'
            : 'empty';

        return {
          id: p.id,
          name: p.name,
          type: p.type,
          status,
          createdAt: p.createdAt,
          lastModifiedAt: p.lastModifiedAt,
          repositoryId: p.repositoryId,
          knowledgeModel: p.knowledgeModel,
        };
      });

      this._workspaces$.next(restored);
      // Activate the most recently modified workspace
      const first = restored[0];
      if (first) this._activeId$.next(first.id);
    } catch {
      // Storage unavailable — start fresh, no user-visible error needed
    }
  }

  private scheduleSave(ws: Workspace): void {
    if (!this.electronService.isElectron) return;

    const existing = this._saveTimers.get(ws.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this._saveTimers.delete(ws.id);
      const current = this.getById(ws.id);
      if (current) {
        const payload: PersistedWorkspace = {
          id: current.id,
          name: current.name,
          type: current.type,
          status: current.status,
          createdAt: current.createdAt,
          lastModifiedAt: current.lastModifiedAt,
          repositoryId: current.repositoryId,
          knowledgeModel: current.knowledgeModel,
        };
        this.electronService.saveWorkspace(payload);
      }
    }, 300);

    this._saveTimers.set(ws.id, timer);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private patch(id: string, delta: Partial<Workspace>): void {
    const updated = this._workspaces$.value.map((w) => (w.id === id ? { ...w, ...delta } : w));
    this._workspaces$.next(updated);

    const patched = updated.find((w) => w.id === id);
    if (patched) this.scheduleSave(patched);
  }

  private routeForType(type: WorkspaceType): string {
    if (type === 'file') return '/file-analysis';
    if (type === 'folder') return '/folder-analysis';
    return '/repository-analysis';
  }

  private generateId(): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
