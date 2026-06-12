import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnalysisSession } from '../models/analysis-session.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { WorkspaceScope } from '../models/modified-file.model';
import { RepositoryKnowledge, KnowledgeState } from '../models/knowledge.model';

export interface WorkspaceState {
  session: AnalysisSession | null;
  context: WorkspaceContext | null;
  knowledge: RepositoryKnowledge | null;
  knowledgeState: KnowledgeState;
}

interface ScopedStore {
  session$:        BehaviorSubject<AnalysisSession | null>;
  context$:        BehaviorSubject<WorkspaceContext | null>;
  knowledge$:      BehaviorSubject<RepositoryKnowledge | null>;
  knowledgeState$: BehaviorSubject<KnowledgeState>;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceManagerService {

  private readonly stores: Record<WorkspaceScope, ScopedStore> = {
    file: this.createStore(),
    folder: this.createStore(),
    repository: this.createStore(),
  };

  // ── Session ───────────────────────────────────────────────────────────────

  session$(scope: WorkspaceScope): Observable<AnalysisSession | null> {
    return this.stores[scope].session$.asObservable();
  }

  getSession(scope: WorkspaceScope): AnalysisSession | null {
    return this.stores[scope].session$.value;
  }

  setSession(scope: WorkspaceScope, session: AnalysisSession): void {
    this.stores[scope].session$.next(session);
  }

  // ── Workspace Context ─────────────────────────────────────────────────────

  context$(scope: WorkspaceScope): Observable<WorkspaceContext | null> {
    return this.stores[scope].context$.asObservable();
  }

  getContext(scope: WorkspaceScope): WorkspaceContext | null {
    return this.stores[scope].context$.value;
  }

  setContext(scope: WorkspaceScope, ctx: WorkspaceContext): void {
    this.stores[scope].context$.next(ctx);
  }

  clearContext(scope: WorkspaceScope): void {
    this.stores[scope].context$.next(null);
  }

  // ── Knowledge ─────────────────────────────────────────────────────────────

  knowledge$(scope: WorkspaceScope): Observable<RepositoryKnowledge | null> {
    return this.stores[scope].knowledge$.asObservable();
  }

  getKnowledge(scope: WorkspaceScope): RepositoryKnowledge | null {
    return this.stores[scope].knowledge$.value;
  }

  setKnowledge(scope: WorkspaceScope, knowledge: RepositoryKnowledge): void {
    this.stores[scope].knowledge$.next(knowledge);
  }

  knowledgeState$(scope: WorkspaceScope): Observable<KnowledgeState> {
    return this.stores[scope].knowledgeState$.asObservable();
  }

  getKnowledgeState(scope: WorkspaceScope): KnowledgeState {
    return this.stores[scope].knowledgeState$.value;
  }

  setKnowledgeState(scope: WorkspaceScope, state: KnowledgeState): void {
    this.stores[scope].knowledgeState$.next(state);
  }

  clearKnowledge(scope: WorkspaceScope): void {
    this.stores[scope].knowledge$.next(null);
    this.stores[scope].knowledgeState$.next(KnowledgeState.NotStarted);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private createStore(): ScopedStore {
    return {
      session$:        new BehaviorSubject<AnalysisSession | null>(null),
      context$:        new BehaviorSubject<WorkspaceContext | null>(null),
      knowledge$:      new BehaviorSubject<RepositoryKnowledge | null>(null),
      knowledgeState$: new BehaviorSubject<KnowledgeState>(KnowledgeState.NotStarted),
    };
  }
}
