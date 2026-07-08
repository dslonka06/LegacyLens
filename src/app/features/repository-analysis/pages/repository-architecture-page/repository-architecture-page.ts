import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArchitecturePattern, RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { RepositoryKnowledgeService } from '@app/knowledge/services/repository-knowledge.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { DependencyExplorerService } from '@app/knowledge/services/dependency-explorer.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

@Component({
  selector: 'app-repository-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-architecture-page.html',
  styleUrl: './repository-architecture-page.scss',
})
export class RepositoryArchitecturePage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  hubList: Array<{ name: string; degree: number }> = [];

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly depExplorer: DependencyExplorerService,
    private readonly manager: WorkspaceManagerService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    void this.refreshHubs(this.knowledge);
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; void this.refreshHubs(k); }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  private async refreshHubs(knowledge: RepositoryKnowledge | null): Promise<void> {
    const graph = knowledge?.dependencyGraph;
    if (!graph) { this.hubList = []; return; }
    const hubs = await this.depExplorer.dependencyHubs(graph);
    this.hubList = hubs.slice(0, 8).map(h => ({ name: h.node.name, degree: h.degree }));
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  get patterns(): ArchitecturePattern[] {
    return this.knowledge?.architecture?.patterns ?? [];
  }

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Repository';
  }

  get nodeCount(): number {
    return this.knowledge?.dependencyGraph?.nodes.length ?? 0;
  }

  get edgeCount(): number {
    return this.knowledge?.dependencyGraph?.edges.length ?? 0;
  }

  get hubs(): Array<{ name: string; degree: number }> {
    return this.hubList;
  }

  get topDependencies(): string[] {
    if (!this.knowledge?.dependencyGraph) return [];
    const edges = this.knowledge.dependencyGraph.edges;
    const nodeMap = new Map(this.knowledge.dependencyGraph.nodes.map(n => [n.id, n.name]));
    const counts = new Map<string, number>();
    edges.forEach(e => counts.set(e.target, (counts.get(e.target) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => nodeMap.get(id) ?? id);
  }

  confidencePercent(p: ArchitecturePattern): number {
    return Math.round((p.confidence ?? 0) * 100);
  }

  get architectureNarrative(): string {
    const ai = this.manager.getActive()?.aiExplanation?.content;
    if (ai) return ai;
    const patterns = this.patterns;
    if (!patterns.length) return '';
    const names = patterns.slice(0, 3).map(p => p.name).join(', ');
    const nodes = this.nodeCount;
    const edges = this.edgeCount;
    return `This repository follows a ${names} structure with ${nodes} modules and ${edges} dependency connections.`;
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
