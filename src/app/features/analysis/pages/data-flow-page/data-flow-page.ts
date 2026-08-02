import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import { MermaidDiagram } from '@app/shared/components/mermaid-diagram/mermaid-diagram';
import type { KnowledgeModel, DataFlowInsight } from '@app/knowledge/models/knowledge-model.contract';
import type { WorkflowRiskProfile } from '@app/knowledge/models/data-flow-ai-analysis.model';

@Component({
  selector: 'app-data-flow-page',
  standalone: true,
  imports: [CommonModule, ThemeToggle, ExplanationCard, MermaidDiagram],
  templateUrl: './data-flow-page.html',
  styleUrl: './data-flow-page.scss',
})
export class DataFlowPage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  hasWorkspace = false;
  expandedStepIndex: number | null = null;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.model = this.manager.getActive()?.knowledgeModel ?? null;
    this.hasWorkspace = this.model != null;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.model = ws?.knowledgeModel ?? null;
      this.hasWorkspace = this.model != null;
      this.expandedStepIndex = null;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── File-scope: structured deterministic data flow from insights ────────────

  get fileDataFlow(): DataFlowInsight | null {
    return this.model?.insights.dataFlow ?? null;
  }

  get isFileScope(): boolean {
    return this.model?.capabilities?.includes('insightExtraction') ?? false;
  }

  get fileStepNarrative(): string[] {
    return this.model?.ai?.dataFlowFileNarrative?.stepNarrative ?? [];
  }

  toggleStep(index: number): void {
    this.expandedStepIndex = this.expandedStepIndex === index ? null : index;
  }

  isStepExpanded(index: number): boolean {
    return this.expandedStepIndex === index;
  }

  // ── Multi-file: dependency graph based flow ─────────────────────────────────

  get workspaceName(): string {
    return this.model?.workspaceName ?? 'Workspace';
  }

  get hasDataFlow(): boolean {
    return this.isFileScope
      ? (this.fileDataFlow?.steps.length ?? 0) > 0
      : (this.model?.relationships.dependencies?.graph.nodes.length ?? 0) > 0;
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.model?.ai?.summaries?.dataFlow ?? null;
  }

  get dataFlowDiagram(): string | null {
    return this.model?.ai?.dataFlow?.dataFlowDiagram ?? null;
  }

  // ── Folder/repo: structured workflow data ────────────────────────────────────

  get primaryWorkflows(): WorkflowRiskProfile[] {
    return this.model?.ai?.dataFlow?.primaryWorkflows ?? [];
  }

  get entryPoints(): string[] {
    return this.model?.ai?.dataFlow?.entryPoints ?? [];
  }

  get bottlenecks(): string[] {
    return this.model?.ai?.dataFlow?.bottlenecks ?? [];
  }

  get externalDependencies(): string[] {
    return this.model?.ai?.dataFlow?.externalDependencies ?? [];
  }

  get workflowCount(): number {
    return this.model?.ai?.dataFlow?.workflowCount ?? 0;
  }

  expandedWorkflowIndex: number | null = null;

  toggleWorkflow(index: number): void {
    this.expandedWorkflowIndex = this.expandedWorkflowIndex === index ? null : index;
  }

  isWorkflowExpanded(index: number): boolean {
    return this.expandedWorkflowIndex === index;
  }

  riskClass(risk: string): string {
    return { High: 'risk-high', Moderate: 'risk-moderate', Low: 'risk-low' }[risk] ?? 'risk-low';
  }

}
