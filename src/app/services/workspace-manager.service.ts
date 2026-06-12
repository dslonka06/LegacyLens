import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Router } from '@angular/router';
import { Workspace, WorkspaceType, WorkspaceStatus, MAX_WORKSPACES } from '../models/workspace-entity.model';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from '../models/knowledge.model';
import { ModifiedFile, ModifiedFileStatus, RecommendationSource } from '../models/modified-file.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceManagerService {

  private readonly _workspaces$ = new BehaviorSubject<Workspace[]>([]);
  private readonly _activeId$   = new BehaviorSubject<string | null>(null);

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
    const id = this.generateId();
    const now = new Date().toISOString();
    const defaultName = type === 'file' ? 'File Workspace'
                      : type === 'folder' ? 'Folder Workspace'
                      : 'Repository Workspace';

    const ws: Workspace = {
      id,
      name: name ?? defaultName,
      type,
      status: 'empty',
      createdAt: now,
      lastModifiedAt: now,
      session: null,
      context: null,
      knowledge: null,
      knowledgeState: KnowledgeState.NotStarted,
      changes: [],
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
    const route = this.routeForType(ws.type);
    this.router.navigate([route]);
  }

  // Called by navigation guard — sets active to the first workspace of that
  // type if one exists, or creates a blank one. Returns the workspace, or null
  // if limit reached and no workspace of that type exists.
  activateOrCreateForType(type: WorkspaceType): Workspace | null {
    const existing = this.getByType(type);
    if (existing.length > 0) {
      // Prefer the currently active one if it matches, otherwise pick the first
      const current = this.getActive();
      const target = (current?.type === type) ? current : existing[0];
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

  // ── Session ───────────────────────────────────────────────────────────────

  setSession(id: string, session: AnalysisSession): void {
    this.patch(id, {
      session,
      status: this.deriveStatus(id, { session }),
      lastModifiedAt: new Date().toISOString(),
    });
  }

  // ── Context ───────────────────────────────────────────────────────────────

  setContext(id: string, context: WorkspaceContext): void {
    this.patch(id, {
      context,
      name: context.workspaceName,
      status: this.deriveStatus(id, { context }),
      lastModifiedAt: new Date().toISOString(),
    });
  }

  clearContext(id: string): void {
    this.patch(id, { context: null, status: 'empty', lastModifiedAt: new Date().toISOString() });
  }

  // ── Knowledge ─────────────────────────────────────────────────────────────

  setKnowledge(id: string, knowledge: RepositoryKnowledge): void {
    this.patch(id, {
      knowledge,
      status: this.deriveStatus(id, { knowledge }),
      lastModifiedAt: new Date().toISOString(),
    });
  }

  setKnowledgeState(id: string, state: KnowledgeState): void {
    const status: WorkspaceStatus = state === KnowledgeState.Complete ? 'loaded' : 'analyzing';
    this.patch(id, { knowledgeState: state, status });
  }

  clearKnowledge(id: string): void {
    this.patch(id, { knowledge: null, knowledgeState: KnowledgeState.NotStarted });
  }

  // ── Changes ───────────────────────────────────────────────────────────────

  changes$(id: string): Observable<ModifiedFile[]> {
    return this._workspaces$.pipe(
      map(ws => ws.find(w => w.id === id)?.changes ?? []),
      distinctUntilChanged(),
    );
  }

  getChanges(id: string): ModifiedFile[] {
    return this.getById(id)?.changes ?? [];
  }

  saveChange(
    id: string,
    filePath: string,
    originalContent: string,
    modifiedContent: string,
    rec?: RecommendationSource,
  ): void {
    if (originalContent === modifiedContent) return;
    const ws = this.getById(id);
    if (!ws) return;

    const current = ws.changes;
    const existingIdx = current.findIndex(f => f.filePath === filePath);
    const fileName = filePath.split('/').pop() ?? filePath;

    let recommendations: RecommendationSource[];
    if (existingIdx >= 0) {
      // Merge: add rec if it isn't already in the list (deduplicate by id)
      const prev = current[existingIdx].recommendations;
      recommendations = rec && !prev.some(r => r.id === rec.id)
        ? [...prev, rec]
        : prev;
    } else {
      recommendations = rec ? [rec] : [];
    }

    const entry: ModifiedFile = {
      id: existingIdx >= 0 ? current[existingIdx].id : this.newChangeId(),
      filePath,
      fileName,
      originalContent,
      modifiedContent,
      modifiedAt: new Date().toISOString(),
      status: existingIdx >= 0 ? current[existingIdx].status : 'pending',
      workspaceId: id,
      recommendations,
    };

    const updated = [...current];
    if (existingIdx >= 0) updated[existingIdx] = entry; else updated.push(entry);

    this.patch(id, {
      changes: updated,
      status: 'modified',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  setChangeStatus(id: string, changeId: string, status: ModifiedFileStatus): void {
    const ws = this.getById(id);
    if (!ws) return;
    const changes = ws.changes.map(f => f.id === changeId ? { ...f, status } : f);
    this.patch(id, { changes, status: this.deriveStatusFromChanges(changes) });
  }

  setAllChangeStatus(id: string, status: ModifiedFileStatus): void {
    const ws = this.getById(id);
    if (!ws) return;
    const changes = ws.changes.map(f => ({ ...f, status }));
    this.patch(id, { changes, status: this.deriveStatusFromChanges(changes) });
  }

  private deriveStatusFromChanges(changes: ModifiedFile[]): WorkspaceStatus {
    // 'approved' means ready to export but not yet exported — highest urgency
    if (changes.some(f => f.status === 'approved'))  return 'changes-pending';
    if (changes.some(f => f.status === 'pending'))   return 'modified';
    if (changes.some(f => f.status === 'exported'))  return 'loaded';
    return 'loaded';
  }

  restoreChange(id: string, changeId: string): void {
    const ws = this.getById(id);
    if (!ws) return;
    const changes = ws.changes.filter(f => f.id !== changeId);
    const wsStatus: WorkspaceStatus = changes.length > 0 ? 'modified' : 'loaded';
    this.patch(id, { changes, status: wsStatus });
  }

  isFileModified(id: string, filePath: string): boolean {
    return this.getById(id)?.changes.some(f => f.filePath === filePath) ?? false;
  }

  getChange(id: string, changeId: string): ModifiedFile | null {
    return this.getById(id)?.changes.find(f => f.id === changeId) ?? null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private patch(id: string, delta: Partial<Workspace>): void {
    const updated = this._workspaces$.value.map(w =>
      w.id === id ? { ...w, ...delta } : w
    );
    this._workspaces$.next(updated);
  }

  private deriveStatus(id: string, delta: Partial<Workspace>): WorkspaceStatus {
    const ws = this.getById(id);
    if (!ws) return 'empty';
    const merged = { ...ws, ...delta };
    if (merged.changes.some(f => f.status === 'approved')) return 'changes-pending';
    if (merged.changes.length > 0) return 'modified';
    if (merged.knowledge || merged.session || merged.context) return 'loaded';
    return 'empty';
  }

  private routeForType(type: WorkspaceType): string {
    if (type === 'file')       return '/file-analysis';
    if (type === 'folder')     return '/folder-analysis';
    return '/repository-analysis';
  }

  private generateId(): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  private newChangeId(): string {
    return `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
