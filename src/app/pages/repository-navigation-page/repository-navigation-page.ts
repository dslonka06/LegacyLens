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

  // ── File overview helpers ──────────────────────────────────────────────────

  // Classify the selected node's role based on connectivity pattern
  get nodeRole(): string {
    if (!this.intelligence) return '';
    const inb = this.intelligence.incoming.length;
    const out = this.intelligence.outgoing.length;
    if (inb >= 6 && out >= 6) return 'System Hub';
    if (inb > out * 2 && inb >= 4) return 'Widely Referenced';
    if (out > inb * 2 && out >= 5) return 'Broad Scope';
    if (inb > 0 || out > 0) return 'Connected';
    return 'Standalone';
  }

  get nodeRoleClass(): string {
    const map: Record<string, string> = {
      'System Hub':       'role-hub',
      'Widely Referenced':'role-used',
      'Broad Scope':      'role-broad',
      'Connected':        'role-connected',
      'Standalone':       'role-standalone',
    };
    return map[this.nodeRole] ?? 'role-connected';
  }

  get nodeImportance(): string {
    if (!this.intelligence) return 'Unknown';
    const inb  = this.intelligence.incoming.length;
    const wfs  = this.intelligence.touchingWorkflows.length;
    const risk = this.intelligence.changeImpact.riskLevel;
    if (risk === 'High' || inb >= 8 || wfs >= 3) return 'High';
    if (risk === 'Medium' || inb >= 4 || wfs >= 1) return 'Medium';
    return 'Low';
  }

  get nodeImportanceClass(): string {
    const map: Record<string, string> = { High: 'imp-high', Medium: 'imp-medium', Low: 'imp-low' };
    return map[this.nodeImportance] ?? 'imp-low';
  }

  // Purpose: what does this file exist to do?
  // Derived from file name, path, type, and source content — not from dependency counts.
  get nodePurpose(): string {
    if (!this.intelligence) return '';
    const node    = this.intelligence.node;
    const content = this.resolveSourceContent(node.path ?? node.name);
    return this.buildPurpose(node.name, node.path ?? '', node.type, content);
  }

  private resolveSourceContent(nodePath: string): string {
    if (!this.knowledge?.sourceFiles?.length || !nodePath) return '';
    const normalise = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const target = normalise(nodePath);
    const file = this.knowledge.sourceFiles.find(f => {
      const fp = normalise(f.path);
      return fp === target || fp.endsWith('/' + target) || target.endsWith('/' + normalise(f.path));
    });
    return file?.content ?? '';
  }

  private buildPurpose(name: string, path: string, type: string, content: string): string {
    // ── Step 1: classify by name suffix ──────────────────────────────────────
    const lower = name.toLowerCase();
    const subject = this.stripKnownSuffix(name);

    // ── Step 2: read decorator from content to override role ─────────────────
    const decorator = content ? this.detectDecorator(content) : null;

    // ── Step 3: derive a role verb + framing ──────────────────────────────────
    const role = decorator ?? this.roleFromName(lower, path, type);

    // ── Step 4: extract key public methods if content available ───────────────
    const methods = content ? this.extractPublicMethods(content) : [];
    const methodPart = methods.length > 0
      ? ` Provides: ${methods.slice(0, 2).map(m => m + '()').join(', ')}.`
      : '';

    // ── Step 5: assemble 1–2 sentence description ─────────────────────────────
    const statement = role.template
      .replace('{subject}', subject)
      .replace('{name}', name);

    return statement + methodPart;
  }

  private stripKnownSuffix(name: string): string {
    // Remove file extension fragments and known role suffixes to get the subject
    const withoutExt = name.replace(/\.[^.]+$/, '');
    const suffixes = [
      'Service', 'Controller', 'Component', 'Repository', 'Provider',
      'Module', 'Page', 'Guard', 'Interceptor', 'Resolver', 'Pipe',
      'Directive', 'Facade', 'Store', 'Effect', 'Reducer', 'Action',
      'Builder', 'Factory', 'Handler', 'Manager', 'Engine', 'Processor',
      'Exporter', 'Importer', 'Adapter', 'Gateway', 'Mapper', 'Validator',
      'Model', 'Entity', 'Dto', 'ViewModel', 'Request', 'Response',
    ];
    for (const suffix of suffixes) {
      if (withoutExt.endsWith(suffix) && withoutExt.length > suffix.length) {
        // Insert spaces before capital letters: "AiKnowledge" → "Ai Knowledge"
        return withoutExt.slice(0, -suffix.length)
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
          .trim();
      }
    }
    // No known suffix — return the name with spaces inserted
    return withoutExt
      .replace(/[-_.]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();
  }

  private detectDecorator(content: string): { template: string } | null {
    if (/@Injectable\b/.test(content))
      return { template: '{subject} service — manages {subject} logic and operations.' };
    if (/@Component\b/.test(content))
      return { template: '{subject} component — renders the {subject} UI and handles user interactions.' };
    if (/@Directive\b/.test(content))
      return { template: '{subject} directive — extends element behaviour for {subject} scenarios.' };
    if (/@Pipe\b/.test(content))
      return { template: '{subject} pipe — transforms {subject} values for display.' };
    if (/@NgModule\b/.test(content))
      return { template: '{subject} module — declares and configures the {subject} feature module.' };
    if (/@Controller\b/.test(content))
      return { template: '{subject} controller — handles HTTP requests and responses for {subject}.' };
    return null;
  }

  private roleFromName(lower: string, path: string, nodeType = ''): { template: string } {
    const pathLower = path.toLowerCase().replace(/\\/g, '/');

    if (lower.endsWith('.service.ts') || lower.endsWith('service'))
      return { template: '{subject} service — manages {subject} logic and operations.' };
    if (lower.endsWith('.component.ts') || lower.endsWith('component'))
      return { template: '{subject} component — renders the {subject} view and handles user interactions.' };
    if (lower.endsWith('.page.ts') || lower.endsWith('page') || pathLower.includes('/pages/'))
      return { template: '{subject} page — the top-level routable view for the {subject} feature.' };
    if (lower.endsWith('.controller.ts') || lower.endsWith('controller') || pathLower.includes('/controllers/'))
      return { template: '{subject} controller — routes and handles {subject} HTTP requests.' };
    if (lower.endsWith('.repository.ts') || lower.endsWith('repository') || pathLower.includes('/repositories/'))
      return { template: '{subject} repository — provides data access operations for {subject}.' };
    if (lower.endsWith('.model.ts') || lower.endsWith('model') || pathLower.includes('/models/'))
      return { template: 'Defines the {subject} data model and type contracts.' };
    if (lower.endsWith('.module.ts') || lower.endsWith('module'))
      return { template: '{subject} module — declares and wires the {subject} feature.' };
    if (lower.endsWith('.guard.ts') || lower.endsWith('guard'))
      return { template: '{subject} guard — controls route access for {subject} routes.' };
    if (lower.endsWith('.interceptor.ts') || lower.endsWith('interceptor'))
      return { template: '{subject} interceptor — intercepts and transforms {subject} requests or responses.' };
    if (lower.endsWith('.pipe.ts') || lower.endsWith('pipe'))
      return { template: '{subject} pipe — transforms {subject} values for template display.' };
    if (lower.endsWith('.directive.ts') || lower.endsWith('directive'))
      return { template: '{subject} directive — applies {subject} behaviour to DOM elements.' };
    if (lower.endsWith('.facade.ts') || lower.endsWith('facade'))
      return { template: '{subject} facade — simplifies access to the {subject} subsystem.' };
    if (lower.endsWith('builder') || lower.endsWith('factory'))
      return { template: 'Constructs and assembles {subject} objects or structures.' };
    if (lower.endsWith('handler'))
      return { template: 'Handles {subject} events or commands.' };
    if (lower.endsWith('provider'))
      return { template: 'Provides {subject} integration or configuration.' };
    if (lower.endsWith('adapter'))
      return { template: 'Adapts the {subject} interface for integration with external systems.' };
    if (lower.endsWith('mapper'))
      return { template: 'Maps between {subject} data structures and formats.' };
    if (lower.endsWith('validator'))
      return { template: 'Validates {subject} input and data integrity.' };
    if (lower.endsWith('exporter') || lower.endsWith('importer'))
      return { template: 'Handles {subject} import and export operations.' };
    if (lower.endsWith('config') || lower.endsWith('settings') || lower.endsWith('configuration'))
      return { template: 'Configuration and settings for {subject}.' };
    if (lower.endsWith('.spec.ts') || lower.endsWith('.test.ts') || lower.endsWith('spec') || lower.endsWith('test'))
      return { template: 'Test suite for {subject} — covers expected behaviour and edge cases.' };

    // Path-based fallbacks
    if (pathLower.includes('/services/'))  return { template: '{subject} service — manages {subject} logic.' };
    if (pathLower.includes('/models/'))    return { template: 'Defines the {subject} data structures and type contracts.' };
    if (pathLower.includes('/components/'))return { template: '{subject} component — renders the {subject} UI.' };
    if (pathLower.includes('/guards/'))    return { template: '{subject} guard — controls access to {subject} routes.' };
    if (pathLower.includes('/pipes/'))     return { template: '{subject} pipe — transforms {subject} values.' };
    if (pathLower.includes('/directives/'))return { template: '{subject} directive — adds {subject} behaviour to elements.' };
    if (pathLower.includes('/utils/') || pathLower.includes('/helpers/'))
      return { template: '{subject} utilities — shared helper functions and tools.' };

    // SQL / DB
    if (lower.endsWith('.sql') || lower.endsWith('.sql') || lower.includes('query') || lower.includes('migration'))
      return { template: 'SQL definition or migration for {subject} data.' };

    // Generic fallback — at minimum name the type correctly
    const typeLabel = this.nodeTypeLabel(nodeType);
    return { template: `{name} — ${typeLabel.toLowerCase()} in this repository.` };
  }

  private extractPublicMethods(content: string): string[] {
    const methods: string[] = [];
    // Match public method declarations: optional 'public'/'async' + identifier + '('
    // Excludes constructors and lifecycle hooks
    const LIFECYCLE = new Set([
      'constructor', 'ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'ngAfterViewInit',
      'ngAfterContentInit', 'ngAfterViewChecked', 'ngAfterContentChecked',
    ]);
    const pattern = /(?:^|\n)\s*(?:public\s+)?(?:async\s+)?([a-zA-Z][a-zA-Z0-9_]*)\s*\(/gm;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null && methods.length < 5) {
      const candidate = match[1];
      if (!LIFECYCLE.has(candidate) && !candidate.startsWith('_') && candidate !== 'if' && candidate !== 'for') {
        methods.push(candidate);
      }
    }
    // Return unique names, capped at 3
    return [...new Set(methods)].slice(0, 3);
  }

  get nodeWhyItMatters(): string {
    if (!this.intelligence) return '';
    const inb   = this.intelligence.incoming.length;
    const risk  = this.intelligence.changeImpact.riskLevel;
    const wfs   = this.intelligence.touchingWorkflows.length;
    const total = this.intelligence.changeImpact.directImpacts.length
                + this.intelligence.changeImpact.indirectImpacts.length;

    if (risk === 'High' && inb >= 6) {
      return `High-risk. Used by ${inb} files and affects ${total} components on change. Modifications require careful review of all consumers.`;
    }
    if (risk === 'High') {
      return `Changes here carry high impact — ${total} components are affected. Review change impact before modifying.`;
    }
    if (wfs >= 2) {
      return `Participates in ${wfs} workflows. Breaking changes here may affect multiple user-visible operations.`;
    }
    if (inb >= 4) {
      return `Referenced by ${inb} other files. Even small changes may require updates across multiple consumers.`;
    }
    if (total > 0) {
      return `Changes affect ${total} component${total === 1 ? '' : 's'} directly or indirectly.`;
    }
    return 'Low coupling — changes here are unlikely to affect other components.';
  }

  // Files to explore next: other participants in the same workflows, excluding current node
  get exploreNextFiles(): string[] {
    if (!this.intelligence || this.intelligence.touchingWorkflows.length === 0) return [];
    const currentName = this.intelligence.node.name;
    const seen = new Set<string>([currentName]);
    const suggestions: string[] = [];
    for (const wf of this.intelligence.touchingWorkflows) {
      for (const step of wf.flowPath) {
        if (!seen.has(step) && suggestions.length < 6) {
          seen.add(step);
          suggestions.push(step);
        }
      }
    }
    return suggestions;
  }

  private nodeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      module: 'Module', class: 'Class', query: 'SQL Query',
      template: 'Template', component: 'Component',
      table: 'Table', namespace: 'Namespace', external: 'External reference', file: 'File',
    };
    return labels[type] ?? 'File';
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
