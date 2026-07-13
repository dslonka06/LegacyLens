import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { FileTreePanel } from '@app/shared/components/file-tree-panel/file-tree-panel';
import type {
  KnowledgeModel,
  DataFlowInsight,
} from '@app/knowledge/models/knowledge-model.contract';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

interface FlowNode {
  name: string;
  dependents: number;
  dependencies: number;
  isHub: boolean;
}

@Component({
  selector: 'app-data-flow-page',
  standalone: true,
  imports: [CommonModule, FileTreePanel],
  templateUrl: './data-flow-page.html',
  styleUrl: './data-flow-page.scss',
})
export class DataFlowPage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  hasWorkspace = false;
  flowNodes: FlowNode[] = [];
  expandedWorkflowIndex: number | null = null;
  selectedFilePath: string | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.model = this.manager.getActive()?.knowledgeModel ?? null;
    this.hasWorkspace = this.model != null;
    this.buildFlow(this.model);

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.model = ws?.knowledgeModel ?? null;
      this.hasWorkspace = this.model != null;
      this.buildFlow(this.model);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private buildFlow(model: KnowledgeModel | null): void {
    const graph = model?.relationships.dependencies?.graph;
    if (!graph) {
      this.flowNodes = [];
      return;
    }

    const inbound = new Map<string, number>();
    const outbound = new Map<string, number>();
    graph.edges.forEach((e) => {
      outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    });

    this.flowNodes = graph.nodes
      .map((n) => ({
        name: n.name,
        dependents: inbound.get(n.id) ?? 0,
        dependencies: outbound.get(n.id) ?? 0,
        isHub: (inbound.get(n.id) ?? 0) >= 3,
      }))
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, 30);
  }

  // ── File-scope: structured deterministic data flow from insights ────────────

  get fileDataFlow(): DataFlowInsight | null {
    return this.model?.insights.dataFlow ?? null;
  }

  get isFileScope(): boolean {
    return this.model?.targetType === 'file';
  }

  // ── Multi-file: dependency graph based flow ─────────────────────────────────

  get workspaceName(): string {
    return this.model?.workspaceName ?? 'Workspace';
  }

  get totalNodes(): number {
    return this.model?.relationships.dependencies?.graph.nodes.length ?? 0;
  }

  get totalConnections(): number {
    return this.model?.relationships.dependencies?.graph.edges.length ?? 0;
  }

  get hubCount(): number {
    return this.flowNodes.filter((n) => n.isHub).length;
  }

  get topTargets(): string[] {
    const graph = this.model?.relationships.dependencies?.graph;
    if (!graph) return [];
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n.name]));
    const counts = new Map<string, number>();
    graph.edges.forEach((e) => counts.set(e.target, (counts.get(e.target) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => nodeMap.get(id) ?? id);
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
      : this.flowNodes.length > 0;
  }

  get dataFlowNarrative(): string | null {
    if (!this.hasDataFlow) return null;
    if (this.isFileScope) return null; // file view uses structured steps, not narrative
    const nodes = this.flowNodes.length;
    const hubs = this.hubCount;
    const conns = this.totalConnections;
    const hubDesc =
      hubs > 0
        ? ` ${hubs} hub module${hubs > 1 ? 's' : ''} act as central integration points.`
        : '';
    return `${nodes} modules with ${conns} dependency connections.${hubDesc} The most depended-upon modules drive the core data flow.`;
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }

  flowBarWidth(node: FlowNode): number {
    const max = this.flowNodes[0]?.dependents ?? 1;
    return max > 0 ? Math.round((node.dependents / max) * 100) : 0;
  }

  toggleWorkflow(i: number): void {
    this.expandedWorkflowIndex = this.expandedWorkflowIndex === i ? null : i;
  }

  isWorkflowExpanded(i: number): boolean {
    return this.expandedWorkflowIndex === i;
  }
}
