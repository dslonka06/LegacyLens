import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge } from '../../models/knowledge.model';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';

type RecommendationCategory = 'architecture' | 'dependencies' | 'complexity' | 'modernization';
type Severity = 'high' | 'medium' | 'low';

interface FolderRecommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  severity: Severity;
  expanded: boolean;
}

@Component({
  selector: 'app-folder-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './folder-code-recommendations-page.html',
  styleUrl: './folder-code-recommendations-page.scss',
})
export class FolderCodeRecommendationsPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  hasWorkspace = false;
  recommendations: FolderRecommendation[] = [];
  activeFilter: RecommendationCategory | 'all' = 'all';

  private subs: Subscription[] = [];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
  ) {}

  ngOnInit(): void {
    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    this.buildRecommendations();
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => { this.knowledge = k; this.buildRecommendations(); }),
      this.workspace.context$.subscribe(ctx => { this.hasWorkspace = ctx !== null; }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private buildRecommendations(): void {
    const recs: FolderRecommendation[] = [];
    const graph = this.knowledge?.dependencyGraph;
    const architecture = this.knowledge?.architecture;

    if (graph) {
      // Find highly-coupled nodes
      const inbound = new Map<string, number>();
      graph.edges.forEach(e => inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1));
      const hubs = graph.nodes.filter(n => (inbound.get(n.id) ?? 0) >= 5);

      if (hubs.length > 0) {
        recs.push({
          id: 'high-coupling',
          title: `${hubs.length} highly-coupled module${hubs.length > 1 ? 's' : ''} detected`,
          description: `Files ${hubs.slice(0, 3).map(h => h.name).join(', ')} have 5+ dependents each. Consider splitting responsibilities or introducing an abstraction layer to reduce coupling.`,
          category: 'architecture', severity: 'high', expanded: false,
        });
      }

      // Circular dependency detection (simple check)
      const sources = new Set(graph.edges.map(e => e.source));
      const targets = new Set(graph.edges.map(e => e.target));
      const mutual = [...sources].filter(s => targets.has(s) && graph.edges.some(e => e.source === s && sources.has(e.target) && graph.edges.some(e2 => e2.source === e.target && e2.target === s)));
      if (mutual.length > 0) {
        recs.push({
          id: 'circular-deps',
          title: 'Potential circular dependencies',
          description: 'Modules with mutual references were detected. Circular dependencies can cause initialization issues and make testing harder. Review and break cycles with interfaces or dependency inversion.',
          category: 'dependencies', severity: 'high', expanded: false,
        });
      }

      // Large graph with no architecture pattern
      if (graph.nodes.length > 20 && (!architecture?.patterns.length)) {
        recs.push({
          id: 'no-pattern',
          title: 'No clear architectural pattern detected',
          description: `This folder has ${graph.nodes.length} files but no dominant architecture pattern. Consider organizing by feature, layer (presentation/business/data), or domain to improve maintainability.`,
          category: 'architecture', severity: 'medium', expanded: false,
        });
      }

      // Isolated files
      const connected = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
      const isolated = graph.nodes.filter(n => !connected.has(n.id));
      if (isolated.length > 3) {
        recs.push({
          id: 'isolated-files',
          title: `${isolated.length} isolated files (no imports or dependents)`,
          description: 'These files are not referenced by any other module. They may be dead code, standalone utilities, or entry points. Review to confirm they are intentionally standalone.',
          category: 'complexity', severity: 'low', expanded: false,
        });
      }
    }

    if (architecture?.patterns.length) {
      const lowConfidence = architecture.patterns.filter(p => p.confidence < 0.5);
      if (lowConfidence.length > 0) {
        recs.push({
          id: 'mixed-patterns',
          title: 'Mixed or inconsistent architecture patterns',
          description: `Patterns ${lowConfidence.map(p => p.name).join(', ')} were detected with low confidence. Mixing patterns adds cognitive overhead. Choose a primary pattern and refactor inconsistent areas toward it.`,
          category: 'modernization', severity: 'medium', expanded: false,
        });
      }
    }

    if (recs.length === 0 && this.hasWorkspace) {
      recs.push({
        id: 'no-issues',
        title: 'No significant issues detected',
        description: 'The folder structure and dependency graph look healthy. Continue following established patterns.',
        category: 'architecture', severity: 'low', expanded: false,
      });
    }

    this.recommendations = recs;
  }

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Folder';
  }

  get filteredRecommendations(): FolderRecommendation[] {
    if (this.activeFilter === 'all') return this.recommendations;
    return this.recommendations.filter(r => r.category === this.activeFilter);
  }

  get highCount(): number  { return this.recommendations.filter(r => r.severity === 'high').length; }
  get mediumCount(): number { return this.recommendations.filter(r => r.severity === 'medium').length; }
  get lowCount(): number   { return this.recommendations.filter(r => r.severity === 'low').length; }

  setFilter(f: RecommendationCategory | 'all'): void { this.activeFilter = f; }
  toggleRec(rec: FolderRecommendation): void { rec.expanded = !rec.expanded; }

  severityClass(s: Severity): string {
    return { high: 'sev-high', medium: 'sev-medium', low: 'sev-low' }[s];
  }

  categoryLabel(c: RecommendationCategory): string {
    return { architecture: 'Architecture', dependencies: 'Dependencies', complexity: 'Complexity', modernization: 'Modernization' }[c];
  }
}
