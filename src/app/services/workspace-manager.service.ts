import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Router } from '@angular/router';
import { Workspace, WorkspaceType, WorkspaceStatus, MAX_WORKSPACES } from '../models/workspace-entity.model';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from '../models/knowledge.model';
import { SecurityAnalysis } from '../models/security-analysis.model';
import { SystemUnderstanding } from '../models/system-understanding.model';
import { RecommendationAnalysis } from '../models/recommendation-analysis.model';
import { LearningPathAnalysis } from '../models/learning-path-analysis.model';
import { ExplanationResult } from '../models/ai-explanation-context.model';

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
      securityAnalysis: null,
      systemUnderstanding: null,
      recommendationAnalysis: null,
      learningPathAnalysis: null,
      aiExplanation: null,
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

  // ── Security Analysis ─────────────────────────────────────────────────────

  setSecurityAnalysis(id: string, security: SecurityAnalysis): void {
    this.patch(id, { securityAnalysis: security, lastModifiedAt: new Date().toISOString() });
  }

  clearSecurityAnalysis(id: string): void {
    this.patch(id, { securityAnalysis: null });
  }

  // ── System Understanding ──────────────────────────────────────────────────

  setSystemUnderstanding(id: string, understanding: SystemUnderstanding): void {
    this.patch(id, { systemUnderstanding: understanding, lastModifiedAt: new Date().toISOString() });
  }

  clearSystemUnderstanding(id: string): void {
    this.patch(id, { systemUnderstanding: null });
  }

  // ── Recommendation Analysis ───────────────────────────────────────────────

  setRecommendationAnalysis(id: string, analysis: RecommendationAnalysis): void {
    this.patch(id, { recommendationAnalysis: analysis, lastModifiedAt: new Date().toISOString() });
  }

  clearRecommendationAnalysis(id: string): void {
    this.patch(id, { recommendationAnalysis: null });
  }

  // ── Learning Path Analysis ────────────────────────────────────────────────

  setLearningPathAnalysis(id: string, analysis: LearningPathAnalysis): void {
    this.patch(id, { learningPathAnalysis: analysis, lastModifiedAt: new Date().toISOString() });
  }

  clearLearningPathAnalysis(id: string): void {
    this.patch(id, { learningPathAnalysis: null });
  }

  // ── AI Explanation ────────────────────────────────────────────────────────

  setAiExplanation(id: string, explanation: ExplanationResult): void {
    this.patch(id, { aiExplanation: explanation, lastModifiedAt: new Date().toISOString() });
  }

  clearAiExplanation(id: string): void {
    this.patch(id, { aiExplanation: null });
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
}
