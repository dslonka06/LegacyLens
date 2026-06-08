import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceContext } from '../../models/workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from '../../models/knowledge.model';
import { RepositoryInsight } from '../../services/repository-insights.service';
import { BehaviorInsights, WorkflowSummary } from '../../models/data-flow.model';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { RepositoryInsightsService } from '../../services/repository-insights.service';
import { AiKnowledgeService } from '../../services/ai-knowledge.service';
import { DataFlowDiscoveryService } from '../../services/data-flow-discovery.service';
import { WorkflowExplorerService } from '../../services/workflow-explorer.service';
import { WorkspaceSummary } from '../../components/workspace-summary/workspace-summary';
import { RepositoryPreview } from '../../components/repository-preview/repository-preview';
import { RepositoryIntelligence } from '../../components/repository-intelligence/repository-intelligence';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

export interface RepositoryLayer {
  name: string;
  folders: string[];
}

@Component({
  selector: 'app-repository-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSummary, RepositoryPreview, RepositoryIntelligence, ExplanationCard],
  templateUrl: './repository-analysis-page.html',
  styleUrl: './repository-analysis-page.scss',
})
export class RepositoryAnalysisPage implements OnInit, OnDestroy {

  context: WorkspaceContext | null = null;
  knowledge: RepositoryKnowledge | null = null;
  knowledgeState: KnowledgeState = KnowledgeState.NotStarted;

  insights: RepositoryInsight[] = [];
  behaviorInsights: BehaviorInsights | null = null;
  workflowSummaries: WorkflowSummary[] = [];
  detectedLayers: RepositoryLayer[] = [];

  insightsExpanded = true;
  archExpanded = true;
  dataFlowExpanded = true;

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
    private readonly insightsService: RepositoryInsightsService,
    private readonly aiKnowledge: AiKnowledgeService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
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

  get architecturePatterns() {
    return this.knowledge?.architecture?.patterns ?? [];
  }

  get hasDataFlow(): boolean {
    return this.workflowSummaries.length > 0 || (this.behaviorInsights?.entryPoints.length ?? 0) > 0;
  }

  get workflowCategoryGroups(): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const wf of this.workflowSummaries) {
      counts.set(wf.category, (counts.get(wf.category) ?? 0) + 1);
    }
    const labels: Record<string, string> = {
      'request-handling':  'Request Handling',
      'data-access':       'Data Access',
      'component-service': 'Component → Service',
      'event-processing':  'Event Processing',
      'queue-processing':  'Queue Processing',
      'generic':           'General Flow',
    };
    return Array.from(counts.entries())
      .map(([cat, count]) => ({ label: labels[cat] ?? cat, count }))
      .sort((a, b) => b.count - a.count);
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

  architectureDescription(patternName: string): string {
    const descriptions: Record<string, string> = {
      'Clean Architecture':        'Business logic is isolated from infrastructure. Dependencies point inward — the domain layer has no knowledge of frameworks, databases, or delivery mechanisms.',
      'MVC':                       'Responsibilities are divided into Models (data), Views (presentation), and Controllers (request handling). Each layer has a distinct role and can evolve independently.',
      'CQRS':                      'Read and write operations are handled separately. Queries return data without side effects; commands change state without returning data. This reduces coupling between read and write paths.',
      'Layered Architecture':      'Code is organised into horizontal layers — typically presentation, business logic, and data access. Each layer only depends on the layer directly below it.',
      'Microservice Architecture': 'The system is decomposed into independently deployable services. Each service owns its data and communicates over well-defined interfaces.',
      'Feature-Sliced Design':     'Code is grouped by feature or domain slice rather than by technical layer. Each feature contains its own components, services, and models.',
      'Hexagonal Architecture':    'The application core is surrounded by ports (interfaces) and adapters (implementations). External systems — databases, APIs, UIs — plug in through adapters without touching the core.',
    };
    return descriptions[patternName] ?? 'Architectural pattern detected from folder structure and dependency analysis.';
  }

  toggleInsights(): void   { this.insightsExpanded  = !this.insightsExpanded; }
  toggleArch(): void       { this.archExpanded      = !this.archExpanded; }
  toggleDataFlow(): void   { this.dataFlowExpanded  = !this.dataFlowExpanded; }

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

  dismissExplanation(): void {
    this.explanationContent = null;
    this.explanationError = null;
    this.explanationLoading = false;
  }

  private buildDerivedData(knowledge: RepositoryKnowledge): void {
    this.insights = this.insightsService.analyze(knowledge);

    if (knowledge.dependencyGraph && knowledge.dependencyGraph.nodes.length >= 3) {
      const ctx = this.currentWorkspace.context;
      const flows = this.dataFlowDiscovery.discoverWorkflows(
        knowledge,
        ctx?.profile.repositoryStructure ?? undefined,
      );
      this.workflowSummaries = this.workflowExplorer.buildSummaries(flows);
      this.behaviorInsights = this.dataFlowDiscovery.behaviorInsights(knowledge);
    } else {
      this.workflowSummaries = [];
      this.behaviorInsights = null;
    }

    this.detectedLayers = this.deriveLayers(knowledge);
  }

  // Derive human-readable architectural layers from folder indicators in detected patterns.
  private deriveLayers(knowledge: RepositoryKnowledge): RepositoryLayer[] {
    const patterns = knowledge.architecture?.patterns ?? [];
    if (patterns.length === 0) return [];

    // Layer buckets keyed by semantic name, with known folder → layer mappings
    const layerMap: Record<string, string> = {
      controllers: 'Presentation', views: 'Presentation', pages: 'Presentation',
      components: 'Presentation', screens: 'Presentation', ui: 'Presentation',
      application: 'Application', handlers: 'Application', commands: 'Application',
      queries: 'Application', usecases: 'Application',
      domain: 'Domain', entities: 'Domain', models: 'Domain', core: 'Domain',
      services: 'Services', managers: 'Services',
      infrastructure: 'Infrastructure', repositories: 'Infrastructure',
      data: 'Infrastructure', dal: 'Infrastructure', bll: 'Infrastructure',
      providers: 'Infrastructure', adapters: 'Infrastructure',
      api: 'API', routes: 'API', endpoints: 'API',
    };

    const layerFolders = new Map<string, Set<string>>();
    for (const pattern of patterns) {
      for (const indicator of pattern.indicators) {
        const layer = layerMap[indicator.toLowerCase()];
        if (layer) {
          if (!layerFolders.has(layer)) layerFolders.set(layer, new Set());
          layerFolders.get(layer)!.add(indicator);
        }
      }
    }

    const order = ['Presentation', 'API', 'Application', 'Services', 'Domain', 'Infrastructure'];
    return order
      .filter(l => layerFolders.has(l))
      .map(l => ({ name: l, folders: Array.from(layerFolders.get(l)!) }));
  }
}
