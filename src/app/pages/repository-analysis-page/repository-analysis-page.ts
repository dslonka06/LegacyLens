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
import { DependencyExplorerService } from '../../services/dependency-explorer.service';
import { WorkspaceSummary } from '../../components/workspace-summary/workspace-summary';
import { RepositoryPreview } from '../../components/repository-preview/repository-preview';
import { RepositoryIntelligence } from '../../components/repository-intelligence/repository-intelligence';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

export interface RepositoryLayer {
  name: string;
  description: string;
  folders: string[];
}

export interface MajorResponsibility {
  name: string;
  description: string;
  keyFiles: string[];
}

export interface ArchFlowStage {
  label: string;
  detail: string;
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
  responsibilities: MajorResponsibility[] = [];
  archFlowStages: ArchFlowStage[] = [];
  archSummaryText = '';

  insightsExpanded = true;
  dataFlowExpanded = true;

  // Architecture sub-accordion state — all open by default
  archExpanded         = true;
  archStyleExpanded    = true;
  archLayersExpanded   = true;
  archRespExpanded     = true;
  archFlowExpanded     = true;
  archSummaryExpanded  = true;

  // AI explanation state
  explanationContent: string | null = null;
  explanationTitle = '';
  explanationLoading = false;
  explanationError: string | null = null;

  private subs: Subscription[] = [];

  readonly KnowledgeState = KnowledgeState;

  constructor(
    private readonly currentWorkspace:  CurrentWorkspaceService,
    private readonly knowledgeService:  RepositoryKnowledgeService,
    private readonly insightsService:   RepositoryInsightsService,
    private readonly aiKnowledge:       AiKnowledgeService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer:  WorkflowExplorerService,
    private readonly depExplorer:       DependencyExplorerService,
  ) {}

  ngOnInit(): void {
    this.context      = this.currentWorkspace.context;
    this.knowledge    = this.knowledgeService.knowledge;
    this.knowledgeState = this.knowledgeService.state;

    this.subs.push(
      this.currentWorkspace.context$.subscribe(ctx => { this.context = ctx; }),
      this.knowledgeService.state$.subscribe(state => { this.knowledgeState = state; }),
      this.knowledgeService.knowledge$.subscribe(knowledge => {
        this.knowledge = knowledge;
        if (knowledge) this.buildDerivedData(knowledge);
      }),
    );

    if (this.knowledge) this.buildDerivedData(this.knowledge);
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  // ── Basic getters ─────────────────────────────────────────────────────────

  get profile()        { return this.context?.profile ?? null; }
  get workspaceName(): string { return this.context?.workspaceName ?? 'Repository'; }
  get hasNoWorkspace(): boolean { return this.context === null; }
  get hasKnowledge(): boolean  { return this.knowledge !== null; }

  get isBuilding(): boolean {
    return this.knowledgeState === KnowledgeState.ReadingFiles
        || this.knowledgeState === KnowledgeState.BuildingDependencies
        || this.knowledgeState === KnowledgeState.DetectingArchitecture;
  }

  get architecturePatterns() { return this.knowledge?.architecture?.patterns ?? []; }

  get hasArchSection(): boolean {
    return this.architecturePatterns.length > 0
        || this.detectedLayers.length > 0
        || this.responsibilities.length > 0
        || this.archFlowStages.length > 0
        || this.archSummaryText.length > 0;
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

  // ── Display helpers ───────────────────────────────────────────────────────

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

  // ── Toggle actions ────────────────────────────────────────────────────────

  toggleInsights():    void { this.insightsExpanded     = !this.insightsExpanded; }
  toggleArch():        void { this.archExpanded         = !this.archExpanded; }
  toggleArchStyle():   void { this.archStyleExpanded    = !this.archStyleExpanded; }
  toggleArchLayers():  void { this.archLayersExpanded   = !this.archLayersExpanded; }
  toggleArchResp():    void { this.archRespExpanded     = !this.archRespExpanded; }
  toggleArchFlow():    void { this.archFlowExpanded     = !this.archFlowExpanded; }
  toggleArchSummary(): void { this.archSummaryExpanded  = !this.archSummaryExpanded; }
  toggleDataFlow():    void { this.dataFlowExpanded     = !this.dataFlowExpanded; }

  // ── AI actions ────────────────────────────────────────────────────────────

  get canExplain(): boolean {
    return !!this.context && !!this.knowledge && !this.isBuilding;
  }

  explainSystem(): void {
    if (!this.context || !this.knowledge) return;
    this.explanationTitle   = 'Explain This System';
    this.explanationContent = null;
    this.explanationError   = null;
    this.explanationLoading = true;

    this.subs.push(
      this.aiKnowledge.explainRepository(this.context, this.knowledge).subscribe({
        next:  text => { this.explanationContent = text;                   this.explanationLoading = false; },
        error: err  => { this.explanationError   = err?.message ?? 'AI explanation service is unavailable.';
                         this.explanationLoading = false; },
      })
    );
  }

  dismissExplanation(): void {
    this.explanationContent = null;
    this.explanationError   = null;
    this.explanationLoading = false;
  }

  // ── Derived data pipeline ─────────────────────────────────────────────────

  private buildDerivedData(knowledge: RepositoryKnowledge): void {
    this.insights = this.insightsService.analyze(knowledge);

    if (knowledge.dependencyGraph && knowledge.dependencyGraph.nodes.length >= 3) {
      const ctx   = this.currentWorkspace.context;
      const flows = this.dataFlowDiscovery.discoverWorkflows(
        knowledge,
        ctx?.profile.repositoryStructure ?? undefined,
      );
      this.workflowSummaries = this.workflowExplorer.buildSummaries(flows);
      this.behaviorInsights  = this.dataFlowDiscovery.extractBehaviorInsights(knowledge);
    } else {
      this.workflowSummaries = [];
      this.behaviorInsights  = null;
    }

    this.detectedLayers   = this.deriveLayers(knowledge);
    this.responsibilities = this.deriveResponsibilities(knowledge);
    this.archFlowStages   = this.deriveArchFlowStages(knowledge);
    this.archSummaryText  = this.buildArchSummary(knowledge);
  }

  // ── Part 1: Layer detection ───────────────────────────────────────────────

  private readonly LAYER_MAP: Record<string, { layer: string; description: string }> = {
    // Presentation
    controllers: { layer: 'Presentation', description: 'Handles incoming requests and user interactions.' },
    views:       { layer: 'Presentation', description: 'Renders output and user-facing templates.' },
    pages:       { layer: 'Presentation', description: 'Top-level routable views and page components.' },
    components:  { layer: 'Presentation', description: 'Reusable UI building blocks.' },
    screens:     { layer: 'Presentation', description: 'Mobile or desktop screen-level views.' },
    ui:          { layer: 'Presentation', description: 'Visual components and layout elements.' },
    // API
    api:         { layer: 'API',          description: 'API surface — routes, contracts, and versioning.' },
    routes:      { layer: 'API',          description: 'Route definitions and navigation mapping.' },
    endpoints:   { layer: 'API',          description: 'Explicit endpoint declarations.' },
    // Application
    application: { layer: 'Application',  description: 'Orchestrates use cases and application workflows.' },
    handlers:    { layer: 'Application',  description: 'Command and event handlers.' },
    commands:    { layer: 'Application',  description: 'Write-side operations that change state.' },
    queries:     { layer: 'Application',  description: 'Read-side operations that return data.' },
    usecases:    { layer: 'Application',  description: 'Explicit use case implementations.' },
    // Services
    services:    { layer: 'Services',     description: 'Business logic and domain operations.' },
    managers:    { layer: 'Services',     description: 'Coordination and lifecycle management.' },
    // Domain
    domain:      { layer: 'Domain',       description: 'Core business concepts and rules.' },
    entities:    { layer: 'Domain',       description: 'Domain objects with identity and lifecycle.' },
    models:      { layer: 'Domain',       description: 'Data structures and domain models.' },
    core:        { layer: 'Domain',       description: 'Foundational types and shared domain logic.' },
    // Infrastructure
    infrastructure: { layer: 'Infrastructure', description: 'Technical concerns: persistence, I/O, and external integrations.' },
    repositories:   { layer: 'Infrastructure', description: 'Data access and persistence abstractions.' },
    data:           { layer: 'Infrastructure', description: 'Database access and data mapping.' },
    dal:            { layer: 'Infrastructure', description: 'Data access layer.' },
    bll:            { layer: 'Infrastructure', description: 'Business logic layer (classic layered pattern).' },
    providers:      { layer: 'Infrastructure', description: 'External service providers and integrations.' },
    adapters:       { layer: 'Infrastructure', description: 'Adapters connecting core logic to external systems.' },
  };

  private readonly LAYER_ORDER = ['Presentation', 'API', 'Application', 'Services', 'Domain', 'Infrastructure'];

  private readonly LAYER_DESCRIPTIONS: Record<string, string> = {
    Presentation:  'User interface, routing, and request entry points.',
    API:           'API contracts, route declarations, and versioned endpoints.',
    Application:   'Use cases, workflows, and application-level orchestration.',
    Services:      'Business logic, domain operations, and service coordination.',
    Domain:        'Core business entities, rules, and domain models.',
    Infrastructure:'Persistence, external integrations, and technical infrastructure.',
  };

  private deriveLayers(knowledge: RepositoryKnowledge): RepositoryLayer[] {
    const patterns = knowledge.architecture?.patterns ?? [];

    // Collect candidate folder names — from detected pattern indicators first,
    // then fall back to raw folder names from the repository structure.
    const candidates = new Set<string>();

    for (const p of patterns) {
      for (const ind of p.indicators) candidates.add(ind.toLowerCase());
    }

    // Also scan top-level folder names from the repository structure if available
    const structure = this.currentWorkspace.context?.profile?.repositoryStructure;
    if (structure?.root?.children) {
      for (const folder of structure.root.children) {
        candidates.add(folder.name.toLowerCase());
        for (const sub of folder.children ?? []) {
          candidates.add(sub.name.toLowerCase());
        }
      }
    }

    const layerFolders = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const entry = this.LAYER_MAP[candidate];
      if (!entry) continue;
      if (!layerFolders.has(entry.layer)) layerFolders.set(entry.layer, new Set());
      layerFolders.get(entry.layer)!.add(candidate);
    }

    return this.LAYER_ORDER
      .filter(l => layerFolders.has(l))
      .map(l => ({
        name:        l,
        description: this.LAYER_DESCRIPTIONS[l] ?? '',
        folders:     Array.from(layerFolders.get(l)!),
      }));
  }

  // ── Part 2: Major responsibilities ───────────────────────────────────────

  // Groups dependency graph nodes by top-level folder prefix, then names each
  // group by the dominant node-type within it. Only emits groups with >= 2 nodes
  // to avoid noise on flat repositories.
  private deriveResponsibilities(knowledge: RepositoryKnowledge): MajorResponsibility[] {
    const graph = knowledge.dependencyGraph;
    if (!graph || graph.nodes.length < 5) return [];

    // Group nodes by their top-level folder segment
    const groups = new Map<string, string[]>();
    for (const node of graph.nodes) {
      const segment = this.topLevelSegment(node.path ?? node.name);
      if (!segment) continue;
      if (!groups.has(segment)) groups.set(segment, []);
      groups.get(segment)!.push(node.name);
    }

    // Filter groups with at least 2 files and build responsibility descriptors
    const result: MajorResponsibility[] = [];
    for (const [segment, names] of groups) {
      if (names.length < 2) continue;
      const label = this.humanizeSegment(segment);
      const desc  = this.describeResponsibility(segment, names);
      result.push({
        name:     label,
        description: desc,
        keyFiles: names.slice(0, 3),
      });
    }

    // Sort: largest group first, cap at 6
    return result
      .sort((a, b) => b.keyFiles.length - a.keyFiles.length)
      .slice(0, 6);
  }

  private topLevelSegment(path: string): string {
    // Normalise separators, split, return first meaningful segment
    const parts = path.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
    // Skip common non-meaningful roots
    const skip = new Set(['src', 'app', 'lib', 'main', 'java', 'kotlin', 'swift', 'cs', '.']);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (!skip.has(lower) && !lower.includes('.')) return lower;
    }
    return '';
  }

  private humanizeSegment(segment: string): string {
    // Convert kebab-case / camelCase / snake_case to Title Case words
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private describeResponsibility(segment: string, names: string[]): string {
    // Infer what this group is responsible for by examining the dominant naming patterns
    const lower = segment.toLowerCase();
    const nameStr = names.join(' ').toLowerCase();

    if (/page|component|view|screen|ui/.test(lower))
      return `User interface components and view logic (${names.length} files).`;
    if (/service|manager|engine|processor/.test(lower))
      return `Business logic and domain operations (${names.length} files).`;
    if (/model|entity|domain|core/.test(lower))
      return `Domain models and core business concepts (${names.length} files).`;
    if (/repository|repo|data|dal|store|storage/.test(lower))
      return `Data access and persistence (${names.length} files).`;
    if (/api|controller|handler|endpoint|route/.test(lower))
      return `API surface and request handling (${names.length} files).`;
    if (/util|helper|shared|common|lib/.test(lower))
      return `Shared utilities and cross-cutting concerns (${names.length} files).`;
    if (/test|spec|mock/.test(lower))
      return `Test coverage and test utilities (${names.length} files).`;
    if (/config|setting|env/.test(lower))
      return `Configuration and environment setup (${names.length} files).`;
    if (/migration|schema|seed/.test(lower))
      return `Database schema and migration scripts (${names.length} files).`;

    // Fallback: describe by file count and what names suggest
    if (nameStr.includes('service'))   return `Service layer components (${names.length} files).`;
    if (nameStr.includes('component')) return `UI components (${names.length} files).`;
    return `${names.length} files organised under this area.`;
  }

  // ── Part 3: Arch flow stages ──────────────────────────────────────────────

  // Derives a high-level pipeline narrative from behavior insights and workflow categories.
  // This is NOT individual workflow instances — it's the system-level processing sequence.
  private deriveArchFlowStages(knowledge: RepositoryKnowledge): ArchFlowStage[] {
    if (!this.behaviorInsights) return [];

    const stages: ArchFlowStage[] = [];
    const bi = this.behaviorInsights;

    // Stage 1: Entry
    if (bi.entryPoints.length > 0) {
      stages.push({
        label:  'Entry',
        detail: bi.entryPoints.slice(0, 3).join(', '),
      });
    }

    // Stage 2: Processing — inferred from workflow category distribution
    const cats = this.workflowCategoryGroups.map(g => g.label);
    if (cats.length > 0) {
      stages.push({
        label:  'Processing',
        detail: cats.slice(0, 2).join(' · '),
      });
    }

    // Stage 3: Core services
    if (bi.mostReferencedServices.length > 0) {
      stages.push({
        label:  'Core Services',
        detail: bi.mostReferencedServices.slice(0, 3).join(', '),
      });
    }

    // Stage 4: Data access
    if (bi.frequentlyUsedRepositories.length > 0) {
      stages.push({
        label:  'Data Access',
        detail: bi.frequentlyUsedRepositories.slice(0, 3).join(', '),
      });
    }

    // Stage 5: Bottlenecks / cross-cutting hubs
    if (bi.workflowBottlenecks.length > 0) {
      stages.push({
        label:  'Cross-Cutting',
        detail: bi.workflowBottlenecks.slice(0, 2).join(', '),
      });
    }

    return stages.length >= 2 ? stages : [];
  }

  // ── Part 4: Architecture summary text ────────────────────────────────────

  private buildArchSummary(knowledge: RepositoryKnowledge): string {
    const patterns  = knowledge.architecture?.patterns ?? [];
    const graph     = knowledge.dependencyGraph;
    const layers    = this.detectedLayers;
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;

    if (patterns.length === 0 && nodeCount === 0) return '';

    const parts: string[] = [];

    // Opening: what kind of system and how big
    const topPattern = patterns[0];
    if (topPattern) {
      const conf = this.confidencePercent(topPattern.confidence);
      parts.push(
        `This repository follows a ${topPattern.name} style (${conf}% confidence). ` +
        this.architectureDescription(topPattern.name)
      );
    } else if (nodeCount > 0) {
      parts.push(`The repository contains ${nodeCount} analysed files with ${edgeCount} detected dependency relationships.`);
    }

    // Layer structure paragraph
    if (layers.length >= 2) {
      const layerNames = layers.map(l => l.name).join(', ');
      parts.push(
        `Structurally, responsibilities are separated across ${layers.length} layers: ${layerNames}. ` +
        `${layers[0].description} ` +
        (layers.length > 1 ? `${layers[layers.length - 1].description}` : '')
      );
    }

    // Behaviour paragraph — entry points to data
    const bi = this.behaviorInsights;
    if (bi) {
      const entryStr   = bi.entryPoints.slice(0, 2).join(' and ');
      const serviceStr = bi.mostReferencedServices.slice(0, 2).join(' and ');
      const repoStr    = bi.frequentlyUsedRepositories.slice(0, 2).join(' and ');

      if (entryStr && serviceStr) {
        let sentence = `Requests enter through ${entryStr}`;
        if (serviceStr) sentence += `, are processed by ${serviceStr}`;
        if (repoStr)    sentence += `, and persisted via ${repoStr}`;
        parts.push(sentence + '.');
      }
    }

    // Connectivity summary
    if (graph && nodeCount >= 5) {
      const avg = this.depExplorer.averageConnectivity(graph);
      const hubs = this.depExplorer.dependencyHubs(graph);
      if (avg > 0) {
        let sentence = `Across ${nodeCount} files and ${edgeCount} dependency edges, average connectivity is ${avg}.`;
        if (hubs.length > 0) {
          sentence += ` ${hubs.length} hub${hubs.length === 1 ? '' : 's'} carry significantly above-average coupling — ` +
            `${hubs.slice(0, 2).map(h => h.node.name).join(' and ')} ${hubs.length === 1 ? 'is' : 'are'} central to understanding the overall design.`;
        }
        parts.push(sentence);
      }
    }

    return parts.join('\n\n');
  }
}
