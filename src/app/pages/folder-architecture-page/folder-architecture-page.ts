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
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

@Component({
  selector: 'app-folder-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ExplanationCard],
  templateUrl: './folder-architecture-page.html',
  styleUrl: './folder-architecture-page.scss',
})
export class FolderArchitecturePage implements OnInit, OnDestroy {

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

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

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

  get showExplanationCard(): boolean {
    return this.hasWorkspace && (this.aiLoading || this.aiError !== null || this.aiExplanation !== null);
  }
}
