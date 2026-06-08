import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { SearchResult, SearchResultType, SearchNavigationTarget } from '../models/search-result.model';
import { RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { WorkflowSummary } from '../models/data-flow.model';
import { RepositoryInsight, RepositoryInsightsService } from './repository-insights.service';
import { CurrentWorkspaceService } from './current-workspace.service';
import { RepositoryKnowledgeService } from './repository-knowledge.service';
import { DataFlowDiscoveryService } from './data-flow-discovery.service';
import { WorkflowExplorerService } from './workflow-explorer.service';
import { DocumentationBuilderService } from './documentation-builder.service';
import { RepositorySummaryService } from './repository-summary.service';

// Internal flat representation of every searchable entity.
// Built once per workspace/knowledge change; queried on every keystroke.
interface SearchEntry {
  id: string;
  type: SearchResultType;
  // All text tokens lower-cased for fast matching.
  tokens: string[];
  // Original-case display values.
  title: string;
  description: string;
  source: string;
  navigationTarget: SearchNavigationTarget;
  // Base weight so some entity types rank higher than others.
  baseWeight: number;
}

@Injectable({ providedIn: 'root' })
export class RepositorySearchService implements OnDestroy {

  private index: SearchEntry[] = [];
  private readonly _indexReady$ = new BehaviorSubject<boolean>(false);
  readonly indexReady$ = this._indexReady$.asObservable();

  private subs: Subscription[] = [];

  constructor(
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly docBuilder: DocumentationBuilderService,
    private readonly summaryService: RepositorySummaryService,
  ) {
    // Rebuild the index whenever workspace context or knowledge changes.
    this.subs.push(
      combineLatest([
        this.currentWorkspace.context$.pipe(distinctUntilChanged()),
        this.knowledgeService.knowledge$.pipe(distinctUntilChanged()),
      ]).subscribe(([ctx, knowledge]) => {
        this.buildIndex(ctx, knowledge);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Public query API ──────────────────────────────────────────────────────

  search(query: string): SearchResult[] {
    if (!query || query.trim().length < 2) return [];
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return [];

    const scored: Array<{ entry: SearchEntry; score: number }> = [];

    for (const entry of this.index) {
      const score = this.score(entry, terms);
      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 40).map(({ entry, score }) => ({
      id:               entry.id,
      title:            entry.title,
      type:             entry.type,
      description:      entry.description,
      source:           entry.source,
      relevanceScore:   score,
      navigationTarget: entry.navigationTarget,
    }));
  }

  get hasIndex(): boolean {
    return this.index.length > 0;
  }

  // ── Index build ───────────────────────────────────────────────────────────

  private buildIndex(ctx: WorkspaceContext | null, knowledge: RepositoryKnowledge | null): void {
    this.index = [];
    this._indexReady$.next(false);

    if (!ctx && !knowledge) return;

    if (ctx) {
      this.indexWorkspaceContext(ctx);
    }

    if (knowledge) {
      this.indexDependencyNodes(knowledge);
      this.indexInsights(knowledge);
      this.indexWorkflows(knowledge, ctx);
    }

    if (ctx) {
      this.indexDocumentationSections(ctx, knowledge);
    }

    this._indexReady$.next(true);
  }

  // Files, folders, projects from workspace structure
  private indexWorkspaceContext(ctx: WorkspaceContext): void {
    const structure = ctx.profile.repositoryStructure;
    if (!structure) return;

    // Projects
    for (const project of structure.projects) {
      this.index.push({
        id:          `project:${project.path}`,
        type:        'project',
        tokens:      this.tokenize(project.name, project.type, project.framework, project.language, project.path),
        title:       project.name,
        description: `${project.type} · ${project.framework} · ${project.language}`,
        source:      'Projects',
        baseWeight:  8,
        navigationTarget: { route: '/repository-analysis' },
      });
    }

    // Files and folders from the tree
    this.indexFolderNode(structure.root);
  }

  private indexFolderNode(folder: { name: string; path: string; children: any[]; files: any[] }): void {
    // Index this folder
    if (folder.path) {
      this.index.push({
        id:          `folder:${folder.path}`,
        type:        'folder',
        tokens:      this.tokenize(folder.name, folder.path),
        title:       folder.name,
        description: folder.path,
        source:      'Folders',
        baseWeight:  4,
        navigationTarget: {
          route:    '/repository-navigation',
          nodeName: folder.name,
          nodePath: folder.path,
        },
      });
    }

    // Index files in this folder
    for (const file of folder.files ?? []) {
      this.index.push({
        id:          `file:${file.path}`,
        type:        'file',
        tokens:      this.tokenize(file.name, file.path, file.language, file.extension),
        title:       file.name,
        description: file.path,
        source:      'Files',
        baseWeight:  6,
        navigationTarget: {
          route:    '/repository-navigation',
          nodeName: file.name,
          nodePath: file.path,
        },
      });
    }

    for (const child of folder.children ?? []) {
      this.indexFolderNode(child);
    }
  }

  // DependencyGraph nodes — richer than raw file list; carries inferred type
  private indexDependencyNodes(knowledge: RepositoryKnowledge): void {
    if (!knowledge.dependencyGraph) return;

    for (const node of knowledge.dependencyGraph.nodes) {
      const existingFileEntry = this.index.find(e => e.type === 'file' && e.id === `file:${node.path}`);

      if (existingFileEntry) {
        // Upgrade existing file entry with node id for nav target resolution
        existingFileEntry.navigationTarget.nodeId = node.id;
        // Merge type token
        existingFileEntry.tokens.push(...this.tokenize(node.type));
        continue;
      }

      // Dependency node with no matching workspace file — index standalone
      this.index.push({
        id:          `node:${node.id}`,
        type:        'file',
        tokens:      this.tokenize(node.name, node.path ?? '', node.type),
        title:       node.name,
        description: node.path ?? node.type,
        source:      'Files',
        baseWeight:  5,
        navigationTarget: {
          route:    '/repository-navigation',
          nodeId:   node.id,
          nodeName: node.name,
          nodePath: node.path ?? '',
        },
      });
    }
  }

  // Dependency graph–derived insights
  private indexInsights(knowledge: RepositoryKnowledge): void {
    const insights: RepositoryInsight[] = this.insightsService.analyze(knowledge);
    for (const insight of insights) {
      this.index.push({
        id:          `insight:${insight.title}`,
        type:        'insight',
        tokens:      this.tokenize(insight.title, insight.description, insight.category, insight.severity, ...(insight.affectedFiles ?? [])),
        title:       insight.title,
        description: insight.description,
        source:      'Insights',
        baseWeight:  7,
        navigationTarget: {
          route:        '/repository-analysis',
          insightTitle: insight.title,
        },
      });
    }
  }

  // Workflows discovered from data flow
  private indexWorkflows(knowledge: RepositoryKnowledge, ctx: WorkspaceContext | null): void {
    const structure = ctx?.profile.repositoryStructure;
    const flows = structure
      ? this.dataFlowDiscovery.discoverWorkflows(knowledge, structure)
      : this.dataFlowDiscovery.discoverWorkflows(knowledge);
    const summaries: WorkflowSummary[] = this.workflowExplorer.buildSummaries(flows);

    for (const wf of summaries) {
      this.index.push({
        id:          `workflow:${wf.title}`,
        type:        'workflow',
        tokens:      this.tokenize(wf.title, wf.description, wf.category, ...wf.steps, ...wf.flowPath),
        title:       wf.title,
        description: wf.description,
        source:      'Workflows',
        baseWeight:  9,
        navigationTarget: {
          route:    '/repository-navigation',
          // flowPath[0] is the entry node; navigate to it to show the workflow
          nodeName: wf.flowPath[0] ?? wf.title,
        },
      });
    }
  }

  // Documentation sections from the doc builder
  private indexDocumentationSections(ctx: WorkspaceContext, knowledge: RepositoryKnowledge | null): void {
    const summary = this.summaryService.build(ctx, knowledge, null, null);
    const sections = this.docBuilder.buildSectionList(summary, null);

    for (const section of sections) {
      if (!section.available) continue;

      this.index.push({
        id:          `doc:${section.id}`,
        type:        'documentation',
        tokens:      this.tokenize(section.title, section.description, section.id),
        title:       section.title,
        description: section.description,
        source:      'Documentation',
        baseWeight:  6,
        navigationTarget: {
          route:     '/documentation',
          sectionId: section.id,
        },
      });
    }

    // Also index key files and key projects from summary as repository-section hits
    for (const kf of summary.keyFiles ?? []) {
      this.index.push({
        id:          `keysection-file:${kf.path}`,
        type:        'repository-section',
        tokens:      this.tokenize(kf.name, kf.path, kf.reason),
        title:       kf.name,
        description: kf.reason,
        source:      'Key Files',
        baseWeight:  7,
        navigationTarget: {
          route:    '/repository-navigation',
          nodeName: kf.name,
          nodePath: kf.path,
        },
      });
    }

    for (const kp of summary.keyProjects ?? []) {
      this.index.push({
        id:          `keysection-project:${kp.path}`,
        type:        'repository-section',
        tokens:      this.tokenize(kp.name, kp.path, kp.type, kp.framework, kp.language),
        title:       kp.name,
        description: `${kp.type} · ${kp.framework}`,
        source:      'Key Projects',
        baseWeight:  7,
        navigationTarget: { route: '/repository-analysis' },
      });
    }
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  private score(entry: SearchEntry, terms: string[]): number {
    let total = 0;

    for (const term of terms) {
      let termScore = 0;

      for (const token of entry.tokens) {
        if (token === term) {
          termScore = Math.max(termScore, 10);         // exact match
        } else if (token.startsWith(term)) {
          termScore = Math.max(termScore, 7);          // prefix match
        } else if (token.includes(term)) {
          termScore = Math.max(termScore, 4);          // substring match
        }
      }

      // Title tokens get a bonus on top of token score
      const titleTokens = this.tokenize(entry.title);
      for (const t of titleTokens) {
        if (t === term)             termScore = Math.max(termScore, 14);
        else if (t.startsWith(term)) termScore = Math.max(termScore, 10);
        else if (t.includes(term))  termScore = Math.max(termScore, 6);
      }

      if (termScore === 0) return 0; // all terms must match
      total += termScore;
    }

    // Multi-term bonus: prefer results that match more query tokens
    total += (terms.length - 1) * 2;

    return total + entry.baseWeight;
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  private tokenize(...parts: string[]): string[] {
    const tokens: string[] = [];
    for (const part of parts) {
      if (!part) continue;
      // Lower-case whole string as one token
      tokens.push(part.toLowerCase());
      // Split on non-alphanumeric boundaries (camelCase, PascalCase, path separators)
      const words = part
        .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase split
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // acronym split
        .split(/[\s\-_./\\]+/)
        .map(w => w.toLowerCase())
        .filter(w => w.length > 1);
      tokens.push(...words);
    }
    // Deduplicate
    return [...new Set(tokens)];
  }
}
