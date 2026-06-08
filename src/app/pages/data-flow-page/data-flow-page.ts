import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkflowSummary, BehaviorInsights, ChangeImpactAnalysis } from '../../models/data-flow.model';
import { DependencyNode } from '../../models/knowledge.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { DataFlowDiscoveryService } from '../../services/data-flow-discovery.service';
import { WorkflowExplorerService } from '../../services/workflow-explorer.service';
import { ChangeImpactService } from '../../services/change-impact.service';
import { AiKnowledgeService } from '../../services/ai-knowledge.service';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

@Component({
  selector: 'app-data-flow-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ExplanationCard],
  templateUrl: './data-flow-page.html',
  styleUrl: './data-flow-page.scss',
})
export class DataFlowPage implements OnInit, OnDestroy {

  workflows: WorkflowSummary[] = [];
  behaviorInsights: BehaviorInsights | null = null;
  expandedWorkflowIndex: number | null = null;

  // Change Impact
  availableNodes: DependencyNode[] = [];
  impactSearchQuery = '';
  selectedNodeId: string | null = null;
  changeImpact: ChangeImpactAnalysis | null = null;
  impactDetailOpen = false;

  // Single-file fallback
  legacyFlowSteps: string[] = [];
  legacyDescription = '';

  hasRepositoryData = false;

  // AI explanation state — keyed by workflow index so each card is independent
  workflowExplanations = new Map<number, { content: string | null; loading: boolean; error: string | null }>();

  private subs: Subscription[] = [];

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly discovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
    private readonly impactService: ChangeImpactService,
    private readonly aiKnowledge: AiKnowledgeService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { if (k) this.load(); }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private load(): void {
    const knowledge = this.knowledgeService.knowledge;
    const session = this.currentAnalysis.getSession();
    const workspace = this.currentWorkspace.context;

    // ── Repository path ────────────────────────────────────────────────────
    if (knowledge?.dependencyGraph && knowledge.dependencyGraph.nodes.length >= 3) {
      this.hasRepositoryData = true;

      const flows = this.discovery.discoverWorkflows(
        knowledge,
        workspace?.profile.repositoryStructure ?? undefined,
      );
      this.workflows = this.workflowExplorer.buildSummaries(flows);
      this.behaviorInsights = this.discovery.extractBehaviorInsights(knowledge);

      this.availableNodes = knowledge.dependencyGraph.nodes
        .filter(n => n.type !== 'external' && n.type !== 'table' && n.type !== 'namespace')
        .sort((a, b) => a.name.localeCompare(b.name));

      return;
    }

    // ── Single-file fallback ───────────────────────────────────────────────
    this.hasRepositoryData = false;
    if (session?.analysis?.dataFlow) {
      const raw = session.analysis.dataFlow;
      this.legacyFlowSteps = raw.split(/→|->/).map(s => s.trim()).filter(Boolean);
      this.legacyDescription = raw;
    }
  }

  // ── Workflow section ──────────────────────────────────────────────────────

  toggleWorkflow(index: number): void {
    this.expandedWorkflowIndex = this.expandedWorkflowIndex === index ? null : index;
  }

  isExpanded(index: number): boolean {
    return this.expandedWorkflowIndex === index;
  }

  confidencePercent(c: number): number {
    return Math.round(c * 100);
  }

  confidenceClass(c: number): string {
    if (c >= 0.85) return 'conf-high';
    if (c >= 0.65) return 'conf-medium';
    return 'conf-low';
  }

  nodeTypeClass(type: string): string {
    return `node-${type}`;
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

  // ── Change impact section ─────────────────────────────────────────────────

  get filteredNodes(): DependencyNode[] {
    if (!this.impactSearchQuery.trim()) return this.availableNodes.slice(0, 20);
    const q = this.impactSearchQuery.toLowerCase();
    return this.availableNodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 20);
  }

  get showNodeDropdown(): boolean {
    return this.impactSearchQuery.trim().length > 0 && !this.selectedNodeId;
  }

  selectNode(node: DependencyNode): void {
    this.selectedNodeId = node.id;
    this.impactSearchQuery = node.name;
    this.impactDetailOpen = false;
    const knowledge = this.knowledgeService.knowledge;
    if (!knowledge?.dependencyGraph) return;
    this.changeImpact = this.impactService.analyze(node.id, knowledge.dependencyGraph, this.workflows);
  }

  clearImpactSelection(): void {
    this.selectedNodeId = null;
    this.impactSearchQuery = '';
    this.changeImpact = null;
    this.impactDetailOpen = false;
  }

  riskClass(level: string): string {
    const map: Record<string, string> = { High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' };
    return map[level] ?? 'risk-low';
  }

  toggleImpactDetail(): void {
    this.impactDetailOpen = !this.impactDetailOpen;
  }

  // Legacy single-file helper
  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }

  // ── Workflow AI explanation ───────────────────────────────────────────────

  explainWorkflow(index: number, workflow: WorkflowSummary): void {
    const ctx = this.currentWorkspace.context;
    const knowledge = this.knowledgeService.knowledge;
    if (!ctx || !knowledge) return;

    this.workflowExplanations.set(index, { content: null, loading: true, error: null });

    this.subs.push(
      this.aiKnowledge.explainWorkflow(ctx, knowledge, workflow).subscribe({
        next: text => {
          this.workflowExplanations.set(index, { content: text, loading: false, error: null });
        },
        error: err => {
          this.workflowExplanations.set(index, {
            content: null,
            loading: false,
            error: err?.message ?? 'AI explanation service is unavailable.',
          });
        },
      })
    );
  }

  dismissWorkflowExplanation(index: number): void {
    this.workflowExplanations.delete(index);
  }

  getWorkflowExplanation(index: number) {
    return this.workflowExplanations.get(index) ?? null;
  }

  hasWorkflowExplanation(index: number): boolean {
    const e = this.workflowExplanations.get(index);
    return !!e && (e.loading || !!e.content || !!e.error);
  }
}
