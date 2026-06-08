import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceContext } from '../../models/workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from '../../models/knowledge.model';
import { RepositoryInsight } from '../../services/repository-insights.service';
import { FileRanking } from '../../services/dependency-explorer.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { DependencyExplorerService } from '../../services/dependency-explorer.service';
import { RepositoryInsightsService } from '../../services/repository-insights.service';
import { AiKnowledgeService } from '../../services/ai-knowledge.service';
import { WorkspaceSummary } from '../../components/workspace-summary/workspace-summary';
import { RepositoryPreview } from '../../components/repository-preview/repository-preview';
import { RepositoryIntelligence } from '../../components/repository-intelligence/repository-intelligence';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

@Component({
  selector: 'app-repository-analysis-page',
  standalone: true,
  imports: [CommonModule, RouterLink, WorkspaceSummary, RepositoryPreview, RepositoryIntelligence, ExplanationCard],
  templateUrl: './repository-analysis-page.html',
  styleUrl: './repository-analysis-page.scss',
})
export class RepositoryAnalysisPage implements OnInit, OnDestroy {

  context: WorkspaceContext | null = null;
  knowledge: RepositoryKnowledge | null = null;
  knowledgeState: KnowledgeState = KnowledgeState.NotStarted;

  insights: RepositoryInsight[] = [];
  rankings: FileRanking[] = [];

  depsExpanded = true;
  insightsExpanded = true;
  archExpanded = true;

  // AI explanation state
  explanationContent: string | null = null;
  explanationTitle = '';
  explanationLoading = false;
  explanationError: string | null = null;

  private subs: Subscription[] = [];

  readonly KnowledgeState = KnowledgeState;

  constructor(
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly explorer: DependencyExplorerService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly aiKnowledge: AiKnowledgeService,
  ) {}

  ngOnInit(): void {
    this.context = this.currentWorkspace.context;
    this.knowledge = this.knowledgeService.knowledge;
    this.knowledgeState = this.knowledgeService.state;

    this.subs.push(
      this.currentWorkspace.context$.subscribe(ctx => {
        this.context = ctx;
      }),
      this.knowledgeService.state$.subscribe(state => {
        this.knowledgeState = state;
      }),
      this.knowledgeService.knowledge$.subscribe(knowledge => {
        this.knowledge = knowledge;
        if (knowledge) this.buildDerivedData(knowledge);
      }),
    );

    if (this.knowledge) this.buildDerivedData(this.knowledge);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get profile() { return this.context?.profile ?? null; }
  get workspaceName(): string { return this.context?.workspaceName ?? 'Repository'; }
  get isBuilding(): boolean {
    return this.knowledgeState === KnowledgeState.ReadingFiles
      || this.knowledgeState === KnowledgeState.BuildingDependencies
      || this.knowledgeState === KnowledgeState.DetectingArchitecture;
  }

  get hasKnowledge(): boolean { return this.knowledge !== null; }
  get hasNoWorkspace(): boolean { return this.context === null; }

  get projectCount(): number {
    return this.context?.profile.repositoryStructure?.projects.length ?? 0;
  }

  get architecturePatterns() {
    return this.knowledge?.architecture?.patterns ?? [];
  }

  get severityClass(): (s: string) => string {
    return (s: string) => {
      const map: Record<string, string> = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' };
      return map[s] ?? 'sev-info';
    };
  }

  confidencePercent(c: number): number { return Math.round(c * 100); }
  confidenceClass(c: number): string {
    if (c >= 0.85) return 'conf-high';
    if (c >= 0.70) return 'conf-medium';
    return 'conf-low';
  }

  toggleDeps(): void    { this.depsExpanded    = !this.depsExpanded; }
  toggleInsights(): void { this.insightsExpanded = !this.insightsExpanded; }
  toggleArch(): void    { this.archExpanded    = !this.archExpanded; }

  // ── AI actions ────────────────────────────────────────────────────────────

  get canExplain(): boolean {
    return !!this.context && !!this.knowledge && !this.isBuilding;
  }

  explainSystem(): void {
    if (!this.context || !this.knowledge) return;
    this.explanationTitle = 'Explain This System';
    this.explanationContent = null;
    this.explanationError = null;
    this.explanationLoading = true;

    this.subs.push(
      this.aiKnowledge.explainRepository(this.context, this.knowledge).subscribe({
        next: text => {
          this.explanationContent = text;
          this.explanationLoading = false;
        },
        error: err => {
          this.explanationError = err?.message ?? 'AI explanation service is unavailable.';
          this.explanationLoading = false;
        },
      })
    );
  }

  generateOnboarding(): void {
    if (!this.context || !this.knowledge) return;
    this.explanationTitle = 'Onboarding Guide';
    this.explanationContent = null;
    this.explanationError = null;
    this.explanationLoading = true;

    this.subs.push(
      this.aiKnowledge.generateOnboardingGuide(this.context, this.knowledge).subscribe({
        next: text => {
          this.explanationContent = text;
          this.explanationLoading = false;
        },
        error: err => {
          this.explanationError = err?.message ?? 'AI explanation service is unavailable.';
          this.explanationLoading = false;
        },
      })
    );
  }

  dismissExplanation(): void {
    this.explanationContent = null;
    this.explanationError = null;
    this.explanationLoading = false;
  }

  private buildDerivedData(knowledge: RepositoryKnowledge): void {
    if (knowledge.dependencyGraph) {
      this.rankings = this.explorer.rankByConnectivity(knowledge.dependencyGraph, 10);
    }
    this.insights = this.insightsService.analyze(knowledge);
  }
}
