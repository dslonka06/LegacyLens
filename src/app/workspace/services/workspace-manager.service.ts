import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Router } from '@angular/router';
import { Workspace, WorkspaceType, WorkspaceStatus, MAX_WORKSPACES } from '../models/workspace-entity.model';
import type { KnowledgeModel, KnowledgeAIResults, AIStage } from '@app/knowledge/models/knowledge-model.contract';

@Injectable({ providedIn: 'root' })
export class WorkspaceManagerService {

  private readonly _workspaces$ = new BehaviorSubject<Workspace[]>([]);
  private readonly _activeId$   = new BehaviorSubject<string | null>(null);

  // Raw File[] objects keyed by workspace ID — not serializable so kept separate
  // from the Workspace entity. Survives multi-workspace navigation.
  private readonly _rawFiles = new Map<string, File[]>();

  readonly workspaces$ = this._workspaces$.asObservable();
  readonly activeId$   = this._activeId$.asObservable();

  // Emits when auto-create is blocked by the workspace limit — subscribers
  // (analysis pages) can open the switcher modal in response.
  private readonly _limitReached$ = new Subject<void>();
  readonly limitReached$ = this._limitReached$.asObservable();

  readonly activeWorkspace$: Observable<Workspace | null> = this._activeId$.pipe(
    switchMap(id => id
      ? this._workspaces$.pipe(map(ws => ws.find(w => w.id === id) ?? null))
      : of(null)
    ),
    distinctUntilChanged(),
  );

  constructor(private readonly router: Router) {}

  // ── Queries ───────────────────────────────────────────────────────────────

  get workspaces(): Workspace[] { return this._workspaces$.value; }
  get activeId(): string | null { return this._activeId$.value; }

  getActive(): Workspace | null {
    const id = this._activeId$.value;
    return id ? (this._workspaces$.value.find(w => w.id === id) ?? null) : null;
  }

  getById(id: string): Workspace | null {
    return this._workspaces$.value.find(w => w.id === id) ?? null;
  }

  getByType(type: WorkspaceType): Workspace[] {
    return this._workspaces$.value.filter(w => w.type === type);
  }

  canCreate(): boolean {
    return this._workspaces$.value.length < MAX_WORKSPACES;
  }

  workspace$(id: string): Observable<Workspace | null> {
    return this._workspaces$.pipe(
      map(ws => ws.find(w => w.id === id) ?? null),
      distinctUntilChanged(),
    );
  }

  // ── Creation ──────────────────────────────────────────────────────────────

  create(type: WorkspaceType, name?: string): Workspace {
    const id  = this.generateId();
    const now = new Date().toISOString();
    const defaultName = type === 'file'   ? 'File Workspace'
                      : type === 'folder' ? 'Folder Workspace'
                      : 'Repository Workspace';

    const ws: Workspace = {
      id,
      name: name ?? defaultName,
      type,
      status:         'empty',
      createdAt:      now,
      lastModifiedAt: now,
      repositoryId:   null,
      knowledgeModel: null,
    };

    this._workspaces$.next([...this._workspaces$.value, ws]);
    this._activeId$.next(id);
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
      const target  = (current?.type === type) ? current : existing[0];
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
    const remaining = this._workspaces$.value.filter(w => w.id !== id);
    this._workspaces$.next(remaining);

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
      knowledgeModel:  model,
      status:          'ready',
      lastModifiedAt:  new Date().toISOString(),
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
   */
  mergeAIResults(id: string, aiResults: Partial<KnowledgeAIResults>): void {
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
  markAIStageFailed(id: string, stage: AIStage): void {
    const ws = this.getById(id);
    if (!ws?.knowledgeModel) return;

    const existing = ws.knowledgeModel.ai ?? { completedStages: [], failedStages: [] };
    const failedStages = [...new Set([...existing.failedStages, stage])];

    this.patch(id, {
      knowledgeModel: {
        ...ws.knowledgeModel,
        ai: { ...existing, failedStages },
      },
    });
  }

  clearKnowledgeModel(id: string): void {
    this.patch(id, {
      knowledgeModel: null,
      status:         'empty',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  // ── Raw file storage ──────────────────────────────────────────────────────
  // Kept separate from the Workspace entity — File objects are not serializable.

  setRawFiles(id: string, files: File[]): void { this._rawFiles.set(id, files); }
  getRawFiles(id: string): File[]              { return this._rawFiles.get(id) ?? []; }
  clearRawFiles(id: string): void              { this._rawFiles.delete(id); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private patch(id: string, delta: Partial<Workspace>): void {
    const updated = this._workspaces$.value.map(w =>
      w.id === id ? { ...w, ...delta } : w
    );
    this._workspaces$.next(updated);
  }

  private routeForType(type: WorkspaceType): string {
    if (type === 'file')   return '/file-analysis';
    if (type === 'folder') return '/folder-analysis';
    return '/repository-analysis';
  }

  private generateId(): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
