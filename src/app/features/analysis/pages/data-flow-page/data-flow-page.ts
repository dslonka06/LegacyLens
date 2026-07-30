import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { FileTreePanel } from '@app/shared/components/file-tree-panel/file-tree-panel';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import type { KnowledgeModel, DataFlowInsight } from '@app/knowledge/models/knowledge-model.contract';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

@Component({
  selector: 'app-data-flow-page',
  standalone: true,
  imports: [CommonModule, FileTreePanel, ThemeToggle, ExplanationCard],
  templateUrl: './data-flow-page.html',
  styleUrl: './data-flow-page.scss',
})
export class DataFlowPage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  hasWorkspace = false;
  expandedStepIndex: number | null = null;
  selectedFilePath: string | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.model = this.manager.getActive()?.knowledgeModel ?? null;
    this.hasWorkspace = this.model != null;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.model = ws?.knowledgeModel ?? null;
      this.hasWorkspace = this.model != null;
      this.expandedStepIndex = null;
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
    return this.model?.targetType === 'file';
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

  get folderTree(): FolderNode | undefined {
    return this.model?.structure.folderTree;
  }

  onTreeFileSelected(file: FileNode): void {
    this.selectedFilePath = file.path;
  }

  get hasDataFlow(): boolean {
    return this.isFileScope
      ? (this.fileDataFlow?.steps.length ?? 0) > 0
      : (this.model?.relationships.dependencies?.graph.nodes.length ?? 0) > 0;
  }

  get dataFlowNarrative(): string | null {
    if (!this.hasDataFlow || this.isFileScope) return null;
    const nodes = this.model?.relationships.dependencies?.graph.nodes.length ?? 0;
    const conns = this.model?.relationships.dependencies?.graph.edges.length ?? 0;
    return `${nodes} modules with ${conns} dependency connections. The most depended-upon modules drive the core data flow.`;
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.model?.ai?.summaries?.dataFlow ?? null;
  }

}
