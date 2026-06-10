import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge } from '../../models/knowledge.model';
import { RepositoryInsight } from '../../services/repository-insights.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { RepositoryInsightsService } from '../../services/repository-insights.service';

type InsightFilter = 'all' | 'high' | 'medium' | 'low';

@Component({
  selector: 'app-repository-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-code-recommendations-page.html',
  styleUrl: './repository-code-recommendations-page.scss',
})
export class RepositoryCodeRecommendationsPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  insights: RepositoryInsight[] = [];
  activeFilter: InsightFilter = 'all';
  expandedIndex: number | null = null;

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly insightsService: RepositoryInsightsService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    if (this.knowledge) this.insights = this.insightsService.analyze(this.knowledge);
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => {
        this.knowledge = k;
        this.insights = k ? this.insightsService.analyze(k) : [];
      }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  get workspaceName(): string { return this.workspace.context?.workspaceName ?? 'Repository'; }

  get filteredInsights(): RepositoryInsight[] {
    if (this.activeFilter === 'all') return this.insights;
    return this.insights.filter(i => i.severity === this.activeFilter);
  }

  get highCount():   number { return this.insights.filter(i => i.severity === 'high').length; }
  get mediumCount(): number { return this.insights.filter(i => i.severity === 'medium').length; }
  get lowCount():    number { return this.insights.filter(i => i.severity === 'low' || i.severity === 'info').length; }

  setFilter(f: InsightFilter): void { this.activeFilter = f; }
  toggleInsight(i: number): void { this.expandedIndex = this.expandedIndex === i ? null : i; }

  severityClass(s: string): string {
    const map: Record<string, string> = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' };
    return map[s] ?? 'sev-info';
  }
}
