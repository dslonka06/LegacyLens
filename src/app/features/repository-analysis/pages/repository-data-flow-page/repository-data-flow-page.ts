import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { BehaviorInsights, WorkflowSummary } from '@app/analysis/models/data-flow.model';
import { RepositoryKnowledgeService } from '@app/knowledge/services/repository-knowledge.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { DataFlowDiscoveryService } from '@app/analysis/services/data-flow-discovery.service';
import { WorkflowExplorerService } from '@app/analysis/services/workflow-explorer.service';

@Component({
  selector: 'app-repository-data-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-data-flow-page.html',
  styleUrl: './repository-data-flow-page.scss',
})
export class RepositoryDataFlowPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  workflowSummaries: WorkflowSummary[] = [];
  behaviorInsights: BehaviorInsights | null = null;
  expandedWorkflowIndex: number | null = null;

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly discovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    this.buildFlows(this.knowledge);
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; this.buildFlows(k); }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  private async buildFlows(knowledge: RepositoryKnowledge | null): Promise<void> {
    if (!knowledge?.dependencyGraph || knowledge.dependencyGraph.nodes.length < 3) {
      this.workflowSummaries = [];
      this.behaviorInsights = null;
      return;
    }
    const ctx = this.workspace.context;
    const flows = await this.discovery.discoverWorkflows(knowledge, ctx?.profile.repositoryStructure ?? undefined);
    this.workflowSummaries = await this.workflowExplorer.buildSummaries(flows);
    this.behaviorInsights  = this.discovery.extractBehaviorInsights(knowledge);
  }

  get workspaceName(): string { return this.workspace.context?.workspaceName ?? 'Repository'; }
  get hasDataFlow(): boolean  { return this.workflowSummaries.length > 0 || (this.behaviorInsights?.entryPoints.length ?? 0) > 0; }

  get dataFlowNarrative(): string | null {
    if (!this.hasDataFlow) return null;
    const wfCount = this.workflowSummaries.length;
    const catCount = this.workflowCategoryGroups.length;
    const epCount = this.behaviorInsights?.entryPoints?.length ?? 0;
    if (wfCount === 0) return null;
    const epPart = epCount > 0 ? ` with ${epCount} system entry point${epCount > 1 ? 's' : ''}` : '';
    return `${wfCount} workflow${wfCount > 1 ? 's' : ''} discovered across ${catCount} categor${catCount > 1 ? 'ies' : 'y'}${epPart}. The dependency graph reveals the primary data paths and module integration points.`;
  }

  get workflowCategoryGroups(): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const wf of this.workflowSummaries) counts.set(wf.category, (counts.get(wf.category) ?? 0) + 1);
    const labels: Record<string, string> = {
      'request-handling': 'Request Handling', 'data-access': 'Data Access',
      'component-service': 'Component → Service', 'event-processing': 'Event Processing',
      'queue-processing': 'Queue Processing', 'generic': 'General Flow',
    };
    return [...counts.entries()].map(([cat, count]) => ({ label: labels[cat] ?? cat, count })).sort((a, b) => b.count - a.count);
  }

  toggleWorkflow(i: number): void {
    this.expandedWorkflowIndex = this.expandedWorkflowIndex === i ? null : i;
  }

  isWorkflowExpanded(i: number): boolean { return this.expandedWorkflowIndex === i; }

  categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'request-handling': 'Request Handling', 'data-access': 'Data Access',
      'component-service': 'Component → Service', 'event-processing': 'Event Processing',
      'queue-processing': 'Queue Processing', 'generic': 'General Flow',
    };
    return labels[cat] ?? cat;
  }
}
