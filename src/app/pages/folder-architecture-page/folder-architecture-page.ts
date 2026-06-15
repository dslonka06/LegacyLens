import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArchitecturePattern, RepositoryKnowledge } from '../../models/knowledge.model';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';

@Component({
  selector: 'app-folder-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './folder-architecture-page.html',
  styleUrl: './folder-architecture-page.scss',
})
export class FolderArchitecturePage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly manager: WorkspaceManagerService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get patterns(): ArchitecturePattern[] {
    return this.knowledge?.architecture?.patterns ?? [];
  }

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Folder';
  }

  get dependencyNodes(): number {
    return this.knowledge?.dependencyGraph?.nodes.length ?? 0;
  }

  get dependencyEdges(): number {
    return this.knowledge?.dependencyGraph?.edges.length ?? 0;
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
    const nodes = this.dependencyNodes;
    const edges = this.dependencyEdges;
    return `This folder follows a ${names} structure with ${nodes} modules and ${edges} dependency connections.`;
  }
}
