import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArchitecturePattern, RepositoryKnowledge } from '../../models/knowledge.model';
import { ExplanationResult } from '../../models/ai-explanation-context.model';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { AiKnowledgeService } from '../../services/ai-knowledge.service';
import { DependencyExplorerService } from '../../services/dependency-explorer.service';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

@Component({
  selector: 'app-repository-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ExplanationCard],
  templateUrl: './repository-architecture-page.html',
  styleUrl: './repository-architecture-page.scss',
})
export class RepositoryArchitecturePage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  aiExplanation: ExplanationResult | null = null;
  aiLoading = false;
  aiError: string | null = null;

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly manager: WorkspaceManagerService,
    private readonly aiKnowledge: AiKnowledgeService,
    private readonly depExplorer: DependencyExplorerService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
      this.manager.activeWorkspace$.subscribe(ws => {
        this.aiExplanation = ws?.aiExplanation ?? null;
      }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  regenerateExplanation(): void {
    const ctx = this.workspace.context;
    const knowledge = this.knowledge;
    const id = this.manager.activeId;
    if (!ctx || !knowledge || !id) return;

    this.aiLoading = true;
    this.aiError = null;

    this.aiKnowledge.explainRepository(ctx, knowledge).subscribe({
      next: content => {
        this.aiLoading = false;
        this.manager.setAiExplanation(id, {
          type: 'repository',
          title: 'Repository Explanation',
          content,
          generatedAt: new Date().toISOString(),
        });
      },
      error: () => {
        this.aiLoading = false;
        this.aiError = 'Could not reach AI service. Check that the backend is running.';
      },
    });
  }

  dismissExplanation(): void {
    const id = this.manager.activeId;
    if (id) this.manager.clearAiExplanation(id);
  }

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
    const graph = this.knowledge?.dependencyGraph;
    if (!graph) return [];
    const hubs = this.depExplorer.dependencyHubs(graph);
    return hubs.slice(0, 8).map(h => ({
      name: h.node.name,
      degree: h.degree,
    }));
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

  get showExplanationCard(): boolean {
    return this.hasWorkspace && (this.aiLoading || this.aiError !== null || this.aiExplanation !== null);
  }
}
