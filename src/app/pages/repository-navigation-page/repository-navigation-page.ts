import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DependencyNode, KnowledgeState, RepositoryKnowledge } from '../../models/knowledge.model';
import { DataFlow, WorkflowSummary } from '../../models/data-flow.model';
import { Breadcrumb, NavigationEntry, NodeIntelligence } from '../../models/navigation.model';
import { FolderNode, FileNode, RepositoryStructure } from '../../models/repository.model';
import { NavigationContextService } from '../../services/navigation-context.service';
import { NodeIntelligenceFacade } from '../../services/node-intelligence.facade';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { DataFlowDiscoveryService } from '../../services/data-flow-discovery.service';
import { WorkflowExplorerService } from '../../services/workflow-explorer.service';

interface FolderTreeNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
  expanded: boolean;
  fileCount: number;
}

interface FileTreeNode {
  type: 'file';
  name: string;
  path: string;
  language: string;
  extension: string;
  depNode: DependencyNode | null; // resolved from dependency graph; null for unknown files
}

type TreeNode = FolderTreeNode | FileTreeNode;

@Component({
  selector: 'app-repository-navigation-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-navigation-page.html',
  styleUrl: './repository-navigation-page.scss',
})
export class RepositoryNavigationPage implements OnInit, OnDestroy {

  // ── State ─────────────────────────────────────────────────────────────────

  treeRoots: TreeNode[] = [];
  selectedNode: DependencyNode | null = null;
  breadcrumbs: Breadcrumb[] = [];
  canGoBack = false;
  canGoForward = false;
  intelligence: NodeIntelligence | null = null;
  impactDetailOpen = false;
  expandedWorkflowIndex: number | null = null;

  hasWorkspace = false;
  hasStructure = false;
  knowledgeState: KnowledgeState = KnowledgeState.NotStarted;
  navHistory: NavigationEntry[] = [];

  // Exposes KnowledgeState enum values to the template
  readonly KnowledgeState = KnowledgeState;

  private knowledge: RepositoryKnowledge | null = null;
  private flows: DataFlow[] = [];
  private summaries: WorkflowSummary[] = [];
  private lastStructure: RepositoryStructure | null = null;
  private subs: Subscription[] = [];

  constructor(
    readonly nav:              NavigationContextService,
    private readonly facade:   NodeIntelligenceFacade,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace:        CurrentWorkspaceService,
    private readonly discovery:        DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.workspace.context$.subscribe(ctx => {
        this.hasWorkspace = ctx !== null;
        const structure = ctx?.profile.repositoryStructure ?? null;
        this.hasStructure = structure !== null;
        // Only rebuild tree when structure identity changes — preserves folder expanded state
        if (structure && structure !== this.lastStructure) {
          this.lastStructure = structure;
          this.buildTree(structure);
        }
      }),
      this.knowledgeService.state$.subscribe(s => {
        this.knowledgeState = s;
      }),
      this.knowledgeService.knowledge$.subscribe(k => {
        this.knowledge = k;
        this.rebuildFlows(k);
        if (k) this.resolveDepNodes(k);
        // Re-run intelligence with fresh knowledge if a node is selected
        if (this.selectedNode && k) {
          this.intelligence = this.buildIntelligence(this.selectedNode);
        }
      }),
      this.nav.selectedNode$.subscribe(node => {
        this.selectedNode = node;
        this.intelligence = node ? this.buildIntelligence(node) : null;
        this.impactDetailOpen = false;
        this.expandedWorkflowIndex = null;
      }),
      this.nav.breadcrumbs$.subscribe(b => this.breadcrumbs = b),
      this.nav.canGoBack$.subscribe(v => this.canGoBack = v),
      this.nav.canGoForward$.subscribe(v => this.canGoForward = v),
      this.nav.history$.subscribe(h => this.navHistory = h),
    );

    // Sync initial state — observables above won't fire for values already emitted
    const ctx = this.workspace.context;
    this.hasWorkspace = ctx !== null;
    const structure = ctx?.profile.repositoryStructure ?? null;
    this.hasStructure = structure !== null;
    if (structure) {
      this.lastStructure = structure;
      this.buildTree(structure);
    }

    this.knowledgeState = this.knowledgeService.state;
    this.knowledge = this.knowledgeService.knowledge;
    this.rebuildFlows(this.knowledge);
    if (this.knowledge) this.resolveDepNodes(this.knowledge);

    this.selectedNode = this.nav.selectedNode;
    this.breadcrumbs  = this.nav.breadcrumbs;
    this.canGoBack    = this.nav.canGoBack;
    this.canGoForward = this.nav.canGoForward;
    this.navHistory   = this.nav.navigationHistory;
    if (this.selectedNode) {
      this.intelligence = this.buildIntelligence(this.selectedNode);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Tree building ─────────────────────────────────────────────────────────

  private buildTree(structure: RepositoryStructure): void {
    this.treeRoots = this.folderToNodes(structure.root);
  }

  private folderToNodes(folder: FolderNode): TreeNode[] {
    const children: TreeNode[] = [
      ...folder.children.map(sub => this.folderNode(sub)),
      ...folder.files.map(f => this.fileNode(f)),
    ];
    return children;
  }

  private folderNode(folder: FolderNode): FolderTreeNode {
    return {
      type: 'folder',
      name: folder.name,
      path: folder.path,
      children: this.folderToNodes(folder),
      expanded: false,
      fileCount: folder.totalFileCount,
    };
  }

  private fileNode(file: FileNode): FileTreeNode {
    return {
      type: 'file',
      name: file.name,
      path: file.path,
      language: file.language,
      extension: file.extension,
      depNode: null,
    };
  }

  private resolveDepNodes(knowledge: RepositoryKnowledge): void {
    if (!knowledge.dependencyGraph) return;
    const graph = knowledge.dependencyGraph;
    this.walkTreeNodes(this.treeRoots, node => {
      if (node.type === 'file') {
        const dep = graph.nodes.find(n =>
          n.path === node.path || n.name === node.name
        ) ?? null;
        node.depNode = dep;
      }
    });
  }

  private walkTreeNodes(nodes: TreeNode[], fn: (n: TreeNode) => void): void {
    for (const node of nodes) {
      fn(node);
      if (node.type === 'folder') this.walkTreeNodes(node.children, fn);
    }
  }

  // ── Data flow helpers ─────────────────────────────────────────────────────

  private rebuildFlows(knowledge: RepositoryKnowledge | null): void {
    if (!knowledge?.dependencyGraph || knowledge.dependencyGraph.nodes.length < 3) {
      this.flows = [];
      this.summaries = [];
      return;
    }
    const ctx = this.workspace.context;
    this.flows = this.discovery.discoverWorkflows(
      knowledge,
      ctx?.profile.repositoryStructure ?? undefined,
    );
    this.summaries = this.workflowExplorer.buildSummaries(this.flows);
  }

  // ── Intelligence ──────────────────────────────────────────────────────────

  private buildIntelligence(node: DependencyNode): NodeIntelligence | null {
    if (!this.knowledge) return null;
    return this.facade.build(node, this.knowledge, this.flows, this.summaries);
  }

  // ── User actions ──────────────────────────────────────────────────────────

  selectFile(fileNode: FileTreeNode): void {
    if (!fileNode.depNode && this.knowledge?.dependencyGraph) {
      // Resolve on demand in case the tree was built before knowledge arrived
      const dep = this.knowledge.dependencyGraph.nodes.find(n =>
        n.path === fileNode.path || n.name === fileNode.name
      );
      fileNode.depNode = dep ?? null;
    }

    const node: DependencyNode = fileNode.depNode ?? {
      id:   fileNode.path || fileNode.name,
      name: fileNode.name,
      path: fileNode.path,
      type: 'module',
    };

    this.nav.selectNode(node, 'file-tree');
  }

  // Navigate to a node by name — used by workflow step clicks and impact file chips.
  // Resolves from the dependency graph first; falls back to a synthetic node so
  // navigation always succeeds (intelligence will show limited data for unknown nodes).
  navigateToName(name: string, source: 'workflow-step' | 'dependency-link'): void {
    const dep = this.knowledge?.dependencyGraph?.nodes.find(n =>
      n.name === name || n.path === name || n.path?.endsWith('/' + name) || n.path?.endsWith('\\' + name)
    );
    const node: DependencyNode = dep ?? { id: name, name, path: name, type: 'module' };
    this.nav.selectNode(node, source);
  }

  navigateToHistoryEntry(entry: NavigationEntry): void {
    const dep = this.knowledge?.dependencyGraph?.nodes.find(n => n.id === entry.nodeId);
    const node: DependencyNode = dep ?? {
      id:   entry.nodeId,
      name: entry.nodeName,
      path: entry.nodePath,
      type: 'module',
    };
    this.nav.selectNode(node, 'direct');
  }

  toggleFolder(folder: FolderTreeNode): void {
    folder.expanded = !folder.expanded;
  }

  back(): void { this.nav.back(); }
  forward(): void { this.nav.forward(); }

  toggleImpactDetail(): void {
    this.impactDetailOpen = !this.impactDetailOpen;
  }

  toggleWorkflow(i: number): void {
    this.expandedWorkflowIndex = this.expandedWorkflowIndex === i ? null : i;
  }

  isWorkflowExpanded(i: number): boolean {
    return this.expandedWorkflowIndex === i;
  }

  isCurrentHistoryEntry(entry: NavigationEntry): boolean {
    return this.selectedNode?.id === entry.nodeId;
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  fileIcon(ext: string): string {
    const map: Record<string, string> = {
      ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡',
      cs: '🟣', fs: '🟣', vb: '🟣',
      html: '🟠', css: '🔵', scss: '🔵',
      json: '📋', xml: '📋', yaml: '📋', yml: '📋',
      sql: '🗄️', py: '🐍', go: '🐹', rs: '⚙️',
      md: '📝',
    };
    return map[ext?.toLowerCase()] ?? '📄';
  }

  riskClass(level: string): string {
    const map: Record<string, string> = { High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' };
    return map[level] ?? 'risk-low';
  }

  severityClass(s: string): string {
    const map: Record<string, string> = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' };
    return map[s] ?? 'sev-info';
  }

  confidenceClass(c: number): string {
    if (c >= 0.85) return 'conf-high';
    if (c >= 0.65) return 'conf-medium';
    return 'conf-low';
  }

  confidencePercent(c: number): number {
    return Math.round(c * 100);
  }

  categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'request-handling':  'Request Handling',
      'data-access':       'Data Access',
      'component-service': 'Component → Service',
      'event-processing':  'Event Processing',
      'queue-processing':  'Queue Processing',
      'generic':           'General Flow',
    };
    return labels[cat] ?? cat;
  }

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Workspace';
  }

  get knowledgeStatusLabel(): string {
    switch (this.knowledgeState) {
      case KnowledgeState.ReadingFiles:          return 'Reading files...';
      case KnowledgeState.BuildingDependencies:  return 'Building dependency graph...';
      case KnowledgeState.DetectingArchitecture: return 'Detecting architecture...';
      case KnowledgeState.Complete:              return 'Repository knowledge ready';
      case KnowledgeState.Failed:                return 'Knowledge build failed';
      default:                                   return '';
    }
  }

  get knowledgeStatusClass(): string {
    switch (this.knowledgeState) {
      case KnowledgeState.Complete: return 'ks-ready';
      case KnowledgeState.Failed:   return 'ks-failed';
      default:                      return 'ks-building';
    }
  }

  get isKnowledgeBuilding(): boolean {
    return this.knowledgeState !== KnowledgeState.Complete
        && this.knowledgeState !== KnowledgeState.NotStarted
        && this.knowledgeState !== KnowledgeState.Failed;
  }

  isSelected(fileNode: FileTreeNode): boolean {
    if (!this.selectedNode) return false;
    if (fileNode.depNode) return fileNode.depNode.id === this.selectedNode.id;
    return fileNode.path === this.selectedNode.path || fileNode.name === this.selectedNode.name;
  }
}
