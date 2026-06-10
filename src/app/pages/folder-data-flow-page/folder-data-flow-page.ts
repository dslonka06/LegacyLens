import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DependencyEdge, DependencyNode, RepositoryKnowledge } from '../../models/knowledge.model';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';

interface FlowNode {
  name: string;
  dependents: number;
  dependencies: number;
  isHub: boolean;
}

@Component({
  selector: 'app-folder-data-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './folder-data-flow-page.html',
  styleUrl: './folder-data-flow-page.scss',
})
export class FolderDataFlowPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  flowNodes: FlowNode[] = [];

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    this.buildFlow();
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; this.buildFlow(); }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private buildFlow(): void {
    const graph = this.knowledge?.dependencyGraph;
    if (!graph) { this.flowNodes = []; return; }

    const inbound = new Map<string, number>();
    const outbound = new Map<string, number>();
    graph.edges.forEach(e => {
      outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    });

    this.flowNodes = graph.nodes
      .map(n => ({
        name: n.name,
        dependents: inbound.get(n.id) ?? 0,
        dependencies: outbound.get(n.id) ?? 0,
        isHub: (inbound.get(n.id) ?? 0) >= 3,
      }))
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, 30);
  }

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Folder';
  }

  get totalFiles(): number {
    return this.knowledge?.dependencyGraph?.nodes.length ?? 0;
  }

  get totalConnections(): number {
    return this.knowledge?.dependencyGraph?.edges.length ?? 0;
  }

  get hubCount(): number {
    return this.flowNodes.filter(n => n.isHub).length;
  }

  flowBarWidth(node: FlowNode): number {
    const max = this.flowNodes[0]?.dependents ?? 1;
    return max > 0 ? Math.round((node.dependents / max) * 100) : 0;
  }
}
