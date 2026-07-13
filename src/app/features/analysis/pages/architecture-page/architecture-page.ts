import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { FileTreePanel } from '@app/shared/components/file-tree-panel/file-tree-panel';
import type { KnowledgeModel, ArchitecturePattern, DependencyHub } from '@app/knowledge/models/knowledge-model.contract';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

@Component({
  selector: 'app-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FileTreePanel],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.scss',
})
export class ArchitecturePage implements OnInit, OnDestroy {

  model: KnowledgeModel | null = null;
  hasWorkspace = false;
  selectedFile: FileNode | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.model       = this.manager.getActive()?.knowledgeModel ?? null;
    this.hasWorkspace = this.model != null;
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.model        = ws?.knowledgeModel ?? null;
      this.hasWorkspace = this.model != null;
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get patterns(): ArchitecturePattern[] {
    return this.model?.relationships.architecture?.patterns ?? [];
  }

  get hubs(): DependencyHub[] {
    return (this.model?.relationships.dependencies?.hubs ?? []).slice(0, 8);
  }

  get nodeCount(): number {
    return this.model?.relationships.dependencies?.graph.nodes.length ?? 0;
  }

  get edgeCount(): number {
    return this.model?.relationships.dependencies?.graph.edges.length ?? 0;
  }

  get topDependencies(): string[] {
    const graph = this.model?.relationships.dependencies?.graph;
    if (!graph) return [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n.name]));
    const counts  = new Map<string, number>();
    graph.edges.forEach(e => counts.set(e.target, (counts.get(e.target) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => nodeMap.get(id) ?? id);
  }

  get workspaceName(): string {
    return this.model?.workspaceName ?? 'Workspace';
  }

  get folderTree(): FolderNode | undefined {
    return this.model?.structure.folderTree;
  }

  onFileSelected(file: FileNode): void {
    this.selectedFile = file;
  }

  get architectureNarrative(): string {
    const ai = this.model?.ai?.understanding?.executiveSummary;
    if (ai) return ai;
    const pts = this.patterns;
    if (!pts.length) return '';
    const names = pts.slice(0, 3).map(p => p.name).join(', ');
    return `This workspace follows a ${names} structure with ${this.nodeCount} modules and ${this.edgeCount} dependency connections.`;
  }

  confidencePercent(p: ArchitecturePattern): number {
    return Math.round((p.confidence ?? 0) * 100);
  }

  architectureDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'Clean Architecture':        'Business logic isolated from infrastructure. Dependencies point inward.',
      'MVC':                       'Model, View, Controller separation — each layer has a distinct role.',
      'CQRS':                      'Read and write operations handled separately. Queries and commands are decoupled.',
      'Layered Architecture':      'Code organised into horizontal layers: presentation, business logic, data access.',
      'Microservice Architecture': 'Independently deployable services, each owning its own data.',
      'Feature-Sliced Design':     'Code grouped by feature slice rather than by technical layer.',
      'Hexagonal Architecture':    'Application core surrounded by ports and adapters.',
    };
    return descriptions[name] ?? 'Architectural pattern detected from folder structure and dependency analysis.';
  }
}
