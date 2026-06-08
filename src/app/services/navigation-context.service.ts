import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { DependencyNode } from '../models/knowledge.model';
import { WorkflowSummary } from '../models/data-flow.model';
import { Breadcrumb, NavigationEntry, NavigationSource } from '../models/navigation.model';
import { CurrentWorkspaceService } from './current-workspace.service';

const MAX_HISTORY_DEPTH = 50;

@Injectable({ providedIn: 'root' })
export class NavigationContextService {

  // ── Core state ────────────────────────────────────────────────────────────

  private readonly _selectedNode$    = new BehaviorSubject<DependencyNode | null>(null);
  private readonly _selectedWorkflow$ = new BehaviorSubject<WorkflowSummary | null>(null);
  private readonly _breadcrumbs$     = new BehaviorSubject<Breadcrumb[]>([]);
  private readonly _canGoBack$       = new BehaviorSubject<boolean>(false);
  private readonly _canGoForward$    = new BehaviorSubject<boolean>(false);
  private readonly _navigationReset$ = new Subject<void>();
  private readonly _history$         = new BehaviorSubject<NavigationEntry[]>([]);

  readonly selectedNode$     = this._selectedNode$.asObservable();
  readonly selectedWorkflow$ = this._selectedWorkflow$.asObservable();
  readonly breadcrumbs$      = this._breadcrumbs$.asObservable();
  readonly canGoBack$        = this._canGoBack$.asObservable();
  readonly canGoForward$     = this._canGoForward$.asObservable();
  // Emits when clear() is called — components use this for teardown.
  readonly navigationReset$  = this._navigationReset$.asObservable();
  // Ordered most-recent first; does NOT include the current node.
  readonly history$          = this._history$.asObservable();

  private backStack:    NavigationEntry[] = [];
  private forwardStack: NavigationEntry[] = [];

  constructor(private readonly currentWorkspace: CurrentWorkspaceService) {}

  // ── Commands ──────────────────────────────────────────────────────────────

  selectNode(node: DependencyNode, source: NavigationSource = 'direct'): void {
    const previous = this._selectedNode$.value;

    // Push current node onto back stack before changing selection
    if (previous) {
      this.backStack = [
        this.toEntry(previous, source),
        ...this.backStack,
      ].slice(0, MAX_HISTORY_DEPTH);
    }

    // Any direct selection invalidates the forward stack
    this.forwardStack = [];

    this._selectedNode$.next(node);
    this._breadcrumbs$.next(this.deriveBreadcrumbs(node));
    this.updateNavFlags();
    this._history$.next([...this.backStack]);
  }

  selectWorkflow(workflow: WorkflowSummary): void {
    this._selectedWorkflow$.next(workflow);
  }

  clearWorkflow(): void {
    this._selectedWorkflow$.next(null);
  }

  back(): void {
    const entry = this.backStack[0];
    if (!entry) return;

    const current = this._selectedNode$.value;
    if (current) {
      // Current node goes to forward stack
      this.forwardStack = [
        this.toEntry(current, 'direct'),
        ...this.forwardStack,
      ].slice(0, MAX_HISTORY_DEPTH);
    }

    this.backStack = this.backStack.slice(1);
    const node = this.entryToNode(entry);
    this._selectedNode$.next(node);
    this._breadcrumbs$.next(this.deriveBreadcrumbs(node));
    this.updateNavFlags();
    this._history$.next([...this.backStack]);
  }

  forward(): void {
    const entry = this.forwardStack[0];
    if (!entry) return;

    const current = this._selectedNode$.value;
    if (current) {
      this.backStack = [
        this.toEntry(current, 'direct'),
        ...this.backStack,
      ].slice(0, MAX_HISTORY_DEPTH);
    }

    this.forwardStack = this.forwardStack.slice(1);
    const node = this.entryToNode(entry);
    this._selectedNode$.next(node);
    this._breadcrumbs$.next(this.deriveBreadcrumbs(node));
    this.updateNavFlags();
    this._history$.next([...this.backStack]);
  }

  // Called when a new workspace is loaded — resets all navigation state.
  clear(): void {
    this.backStack    = [];
    this.forwardStack = [];
    this._selectedNode$.next(null);
    this._selectedWorkflow$.next(null);
    this._breadcrumbs$.next([]);
    this._history$.next([]);
    this.updateNavFlags();
    this._navigationReset$.next();
  }

  // ── Synchronous snapshots ─────────────────────────────────────────────────

  get selectedNode(): DependencyNode | null { return this._selectedNode$.value; }
  get breadcrumbs(): Breadcrumb[] { return this._breadcrumbs$.value; }
  get canGoBack(): boolean { return this._canGoBack$.value; }
  get canGoForward(): boolean { return this._canGoForward$.value; }

  // Ordered from most-recent to oldest; does NOT include the current node.
  get navigationHistory(): NavigationEntry[] { return this._history$.value; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private updateNavFlags(): void {
    this._canGoBack$.next(this.backStack.length > 0);
    this._canGoForward$.next(this.forwardStack.length > 0);
  }

  private toEntry(node: DependencyNode, source: NavigationSource): NavigationEntry {
    return {
      nodeId:    node.id,
      nodeName:  node.name,
      nodePath:  node.path,
      visitedAt: new Date().toISOString(),
      source,
    };
  }

  // Reconstructs a minimal DependencyNode from a history entry so that back()
  // and forward() produce a usable node without re-querying the knowledge service.
  private entryToNode(entry: NavigationEntry): DependencyNode {
    return {
      id:   entry.nodeId,
      name: entry.nodeName,
      path: entry.nodePath,
      type: 'module', // type is metadata; the full node can be resolved by callers if needed
    };
  }

  private deriveBreadcrumbs(node: DependencyNode): Breadcrumb[] {
    const workspaceName = this.currentWorkspace.context?.workspaceName ?? 'Workspace';
    const crumbs: Breadcrumb[] = [
      { label: workspaceName, nodeId: null, type: 'workspace' },
    ];

    if (!node.path) {
      crumbs.push({ label: node.name, nodeId: node.id, type: 'file' });
      return crumbs;
    }

    // Split path into folder segments + file name
    const segments = node.path.replace(/\\/g, '/').split('/').filter(Boolean);
    const fileName  = segments[segments.length - 1] ?? node.name;
    const folders   = segments.slice(0, -1);

    for (const folder of folders) {
      crumbs.push({ label: folder, nodeId: null, type: 'folder' });
    }

    crumbs.push({ label: fileName, nodeId: node.id, type: 'file' });

    return crumbs;
  }
}
