import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DependencyNode, RepositoryKnowledge } from '../../models/knowledge.model';
import { DataFlow, WorkflowSummary } from '../../models/data-flow.model';
import { NodeIntelligence } from '../../models/navigation.model';
import { NavigationContextService } from '../../services/navigation-context.service';
import { NodeIntelligenceFacade } from '../../services/node-intelligence.facade';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { DataFlowDiscoveryService } from '../../services/data-flow-discovery.service';
import { WorkflowExplorerService } from '../../services/workflow-explorer.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';

@Component({
  selector: 'app-nav-playground-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './nav-playground-page.html',
  styleUrl: './nav-playground-page.scss',
})
export class NavPlaygroundPage implements OnInit, OnDestroy {

  // Node list for selection
  availableNodes: DependencyNode[] = [];

  // Navigation state (read from service)
  selectedNode: DependencyNode | null = null;
  canGoBack = false;
  canGoForward = false;
  breadcrumbs: { label: string; type: string }[] = [];
  historyEntries: { nodeName: string; source: string }[] = [];

  // Intelligence result
  intelligence: NodeIntelligence | null = null;

  // Local data snapshots for facade calls
  private knowledge: RepositoryKnowledge | null = null;
  private flows: DataFlow[] = [];
  private summaries: WorkflowSummary[] = [];

  private subs: Subscription[] = [];

  constructor(
    readonly nav:           NavigationContextService,
    private readonly facade:          NodeIntelligenceFacade,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly discovery:        DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
    private readonly workspace:        CurrentWorkspaceService,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => {
        this.knowledge = k;
        this.rebuildDerivedData(k);
      }),
      this.nav.selectedNode$.subscribe(node => {
        this.selectedNode = node;
        this.intelligence = node ? this.buildIntelligence(node) : null;
      }),
      this.nav.canGoBack$.subscribe(v => this.canGoBack = v),
      this.nav.canGoForward$.subscribe(v => this.canGoForward = v),
      this.nav.breadcrumbs$.subscribe(crumbs => {
        this.breadcrumbs = crumbs;
      }),
    );

    // Sync initial knowledge state
    const k = this.knowledgeService.knowledge;
    this.knowledge = k;
    this.rebuildDerivedData(k);
    this.selectedNode = this.nav.selectedNode;
    if (this.selectedNode) {
      this.intelligence = this.buildIntelligence(this.selectedNode);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get hasKnowledge(): boolean {
    return this.availableNodes.length > 0;
  }

  selectNode(node: DependencyNode): void {
    this.nav.selectNode(node, 'file-tree');
  }

  back(): void {
    this.nav.back();
  }

  forward(): void {
    this.nav.forward();
  }

  get navHistory() {
    return this.nav.navigationHistory.slice(0, 5);
  }

  riskClass(level: string): string {
    const map: Record<string, string> = { High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' };
    return map[level] ?? 'risk-low';
  }

  severityClass(s: string): string {
    const map: Record<string, string> = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' };
    return map[s] ?? 'sev-info';
  }

  private rebuildDerivedData(knowledge: RepositoryKnowledge | null): void {
    if (!knowledge?.dependencyGraph) {
      this.availableNodes = [];
      this.flows = [];
      this.summaries = [];
      return;
    }

    this.availableNodes = knowledge.dependencyGraph.nodes
      .filter(n => n.type !== 'external' && n.type !== 'table' && n.type !== 'namespace')
      .sort((a, b) => a.name.localeCompare(b.name));

    this.flows = this.discovery.discoverWorkflows(
      knowledge,
      this.workspace.context?.profile.repositoryStructure ?? undefined,
    );
    this.summaries = this.workflowExplorer.buildSummaries(this.flows);
  }

  private buildIntelligence(node: DependencyNode): NodeIntelligence | null {
    if (!this.knowledge) return null;
    return this.facade.build(node, this.knowledge, this.flows, this.summaries);
  }
}
