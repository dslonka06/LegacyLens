// Types from: @app/analysis/models/recommendation-analysis.model
export interface CodeReference {
  fileName: string;
  methodOrClass?: string;
}

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationCategory = 'architecture' | 'modernization' | 'performance' | 'reliability' | 'complexity' | 'technical-debt' | 'maintainability';

export interface Recommendation {
  id: string;
  title: string;
  priorityScore: number;
  priorityRank: number;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  affectedArea: string;
  affectedFiles: string[];
  codeReference: CodeReference;
  issueDescription: string;
  whyItMatters: string;
  recommendedImprovement: string;
  expectedImpact: string;
}

export interface RecommendationAnalysis {
  criticalCount: number;
  highCount: number;
  technicalDebtLevel: 'Critical' | 'High' | 'Moderate' | 'Low';
  debtContext: string;
  modernizationReadiness: 'Not Ready' | 'Partially Ready' | 'Ready';
  modernizationContext: string;
  recommendations: Recommendation[];
  modernizationAssessment: string;
  generatedAt: string;
}

// Types from: @app/knowledge/models/knowledge.model
export interface SourceFile {
  path: string;
  content: string;
  extension: string;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface RepositoryKnowledge {
  sourceFiles?: SourceFile[];
  dependencyGraph?: {
    nodes: DependencyNode[];
    edges: { source: string; target: string }[];
  };
  architecture?: { patterns: { name: string; confidence: number; indicators: string[] }[] };
}

export class RecommendationAnalysisEngine {

  analyzeFile(): RecommendationAnalysis {
    // File-scope structural analysis has no dependency graph or architecture signals —
    // nothing meaningful to derive without AI bleed-in. Return an empty clean analysis.
    return this.buildAnalysis([], 'file');
  }

  analyzeKnowledge(knowledge: RepositoryKnowledge): RecommendationAnalysis {
    const recs: Omit<Recommendation, 'priorityRank'>[] = [];
    const graph = knowledge.dependencyGraph;
    const architecture = knowledge.architecture;
    const sourceFiles = knowledge.sourceFiles ?? [];
    const primaryFile = this.firstFileName(sourceFiles);

    if (graph) {
      const inbound = new Map<string, number>();
      const outbound = new Map<string, number>();
      graph.edges.forEach(e => {
        inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
        outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
      });

      // ── High-coupling hubs ────────────────────────────────────────────────
      const hubs = graph.nodes
        .filter(n => (inbound.get(n.id) ?? 0) >= 5)
        .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0));

      for (const hub of hubs.slice(0, 3)) {
        const deps = inbound.get(hub.id) ?? 0;
        const priority = deps >= 10 ? 'high' : 'medium';
        recs.push({
          id: `coupling-${hub.id}`,
          title: `High Coupling: ${hub.name}`,
          priorityScore: deps >= 10 ? 80 : 60,
          priority,
          category: 'architecture',
          affectedArea: 'Dependency Management',
          affectedFiles: graph.nodes
            .filter(n => graph.edges.some(e => e.target === hub.id && e.source === n.id))
            .slice(0, 5)
            .map(n => n.name),
          codeReference: this.nodeToCodeRef(hub),
          issueDescription: `${hub.name} has ${deps} direct dependents. Changes to this file propagate risk to ${deps} other modules.`,
          whyItMatters: `A module with ${deps} dependents becomes a single point of failure. Any bug or breaking change forces cascading fixes across ${deps} files, multiplying review and test effort.`,
          recommendedImprovement: `Extract the cohesive responsibilities from ${hub.name} into smaller, focused modules. Introduce an interface or abstraction layer so consumers depend on the abstraction rather than the concrete implementation.`,
          expectedImpact: `Reduced cascade risk; changes to ${hub.name} affect only direct consumers of the abstraction, not all ${deps} callers.`,
        });
      }

      // ── Circular dependencies ─────────────────────────────────────────────
      const sources = new Set(graph.edges.map(e => e.source));
      const targets = new Set(graph.edges.map(e => e.target));
      const mutual = [...sources].filter(s =>
        targets.has(s) &&
        graph.edges.some(e => e.source === s && sources.has(e.target) &&
          graph.edges.some(e2 => e2.source === e.target && e2.target === s))
      );
      if (mutual.length > 0) {
        const node = graph.nodes.find(n => n.id === mutual[0]);
        recs.push({
          id: 'circular-deps',
          title: 'Circular Dependencies Detected',
          priorityScore: 85,
          priority: 'high',
          category: 'architecture',
          affectedArea: 'Module Boundaries',
          affectedFiles: mutual.slice(0, 5).map(id => graph.nodes.find(n => n.id === id)?.name ?? id),
          codeReference: this.nodeToCodeRef(node ?? { id: mutual[0], name: primaryFile, type: 'module', path: primaryFile }),
          issueDescription: `${mutual.length} module${mutual.length !== 1 ? 's' : ''} have mutual import references, creating circular dependency chains.`,
          whyItMatters: 'Circular dependencies cause initialization order failures at runtime, break tree-shaking in bundlers, and make it impossible to load or test modules in isolation.',
          recommendedImprovement: 'Break cycles by introducing a shared model or interface module that both parties can import without importing each other. Apply Dependency Inversion — both modules depend on the abstraction, neither on the other.',
          expectedImpact: 'Elimination of initialization failures; bundler tree-shaking becomes possible; isolated unit testing enabled.',
        });
      }

      // ── No architecture pattern ───────────────────────────────────────────
      if (graph.nodes.length > 20 && !architecture?.patterns.length) {
        recs.push({
          id: 'no-pattern',
          title: 'No Clear Architecture Pattern',
          priorityScore: 50,
          priority: 'medium',
          category: 'architecture',
          affectedArea: 'Structural Organization',
          affectedFiles: [],
          codeReference: { fileName: primaryFile },
          issueDescription: `${graph.nodes.length} files exist with no dominant architecture pattern detected.`,
          whyItMatters: 'Without a consistent structure, every developer builds their own mental model of the codebase. Onboarding time increases and the probability of inconsistent implementations grows with team size.',
          recommendedImprovement: 'Choose an architecture pattern (layered, feature-based, or domain-driven) appropriate for this codebase. Organise existing files into clearly named folders. Document the chosen pattern so new contributors can follow it.',
          expectedImpact: 'Faster onboarding; consistent module placement; reduced cognitive overhead for all contributors.',
        });
      }

      // ── Isolated files ────────────────────────────────────────────────────
      const connected = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
      const isolated = graph.nodes.filter(n => !connected.has(n.id));
      if (isolated.length > 3) {
        recs.push({
          id: 'isolated-files',
          title: `${isolated.length} Isolated Files with No Dependencies`,
          priorityScore: 25,
          priority: 'low',
          category: 'technical-debt',
          affectedArea: 'Dead Code / Unused Modules',
          affectedFiles: isolated.slice(0, 5).map(n => n.name),
          codeReference: this.nodeToCodeRef(isolated[0]),
          issueDescription: `${isolated.length} files have no detected import or export relationships with other modules.`,
          whyItMatters: 'Unreferenced files add noise to the codebase, increase bundle size if accidentally imported, and mislead developers about what code is actually in use.',
          recommendedImprovement: `Review each of the ${isolated.length} isolated files. Delete confirmed dead code. Move standalone utilities into a shared utilities module. Document any intentionally standalone entry points.`,
          expectedImpact: 'Smaller codebase surface area; reduced confusion for new developers; potential bundle size reduction.',
        });
      }

      // ── Broad scope modules ───────────────────────────────────────────────
      const broadScope = graph.nodes
        .filter(n => (outbound.get(n.id) ?? 0) >= 10)
        .sort((a, b) => (outbound.get(b.id) ?? 0) - (outbound.get(a.id) ?? 0))
        .slice(0, 2);

      for (const node of broadScope) {
        const deps = outbound.get(node.id) ?? 0;
        recs.push({
          id: `broad-${node.id}`,
          title: `Broad Scope: ${node.name}`,
          priorityScore: 55,
          priority: 'medium',
          category: 'complexity',
          affectedArea: 'Module Responsibility',
          affectedFiles: graph.edges
            .filter(e => e.source === node.id)
            .slice(0, 5)
            .map(e => graph.nodes.find(n => n.id === e.target)?.name ?? e.target),
          codeReference: this.nodeToCodeRef(node),
          issueDescription: `${node.name} imports ${deps} other modules, indicating it spans multiple concerns.`,
          whyItMatters: `A module that imports ${deps} others is difficult to test in isolation and likely violates the Single Responsibility Principle. It becomes a god module — everything depends on it indirectly.`,
          recommendedImprovement: `Decompose ${node.name} by concern. Separate data-fetching logic from transformation logic. Extract UI state from business logic. Each resulting module should have one clear reason to change.`,
          expectedImpact: 'Improved testability; each concern can be modified independently; reduced compilation cascade on changes.',
        });
      }
    }

    // ── Mixed architecture patterns ───────────────────────────────────────────
    if (architecture?.patterns.length) {
      const lowConfidence = architecture.patterns.filter(p => p.confidence < 0.5);
      if (lowConfidence.length > 0) {
        recs.push({
          id: 'mixed-patterns',
          title: 'Mixed Architecture Patterns Detected',
          priorityScore: 45,
          priority: 'medium',
          category: 'maintainability',
          affectedArea: 'Architecture Consistency',
          affectedFiles: [],
          codeReference: { fileName: primaryFile },
          issueDescription: `Low-confidence pattern detection: ${lowConfidence.map(p => p.name).join(', ')}. Multiple conflicting patterns exist in the same codebase.`,
          whyItMatters: 'Inconsistent patterns force every developer to context-switch between mental models. Each new file placement becomes a judgment call with no right answer.',
          recommendedImprovement: 'Choose a primary pattern and migrate inconsistent areas incrementally. Document the chosen pattern in a short architecture decision record. New code follows the standard; existing code migrates opportunistically during feature work.',
          expectedImpact: 'Consistent file placement; reduced review friction; faster onboarding for new team members.',
        });
      }
    }

    return this.buildAnalysis(recs, primaryFile);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildAnalysis(
    recs: Omit<Recommendation, 'priorityRank'>[],
    _primaryFile: string,
  ): RecommendationAnalysis {
    const sorted = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
    const ranked: Recommendation[] = sorted.map((r, i) => ({ ...r, priorityRank: i + 1 }));

    const criticalCount = ranked.filter(r => r.priority === 'critical').length;
    const highCount     = ranked.filter(r => r.priority === 'high').length;

    const debtLevel    = this.deriveDebtLevel(ranked);
    const modReadiness = this.deriveModernizationReadiness(ranked);

    return {
      criticalCount,
      highCount,
      technicalDebtLevel: debtLevel,
      debtContext: this.buildDebtContext(debtLevel, ranked),
      modernizationReadiness: modReadiness,
      modernizationContext: this.buildModernizationContext(modReadiness, ranked),
      recommendations: ranked,
      modernizationAssessment: this.buildModernizationAssessment(modReadiness, ranked),
      generatedAt: new Date().toISOString(),
    };
  }

  private deriveDebtLevel(recs: Recommendation[]): RecommendationAnalysis['technicalDebtLevel'] {
    const critical = recs.filter(r => r.priority === 'critical').length;
    const high     = recs.filter(r => r.priority === 'high').length;
    if (critical > 0 || high >= 3) return 'Critical';
    if (high >= 1)                 return 'High';
    if (recs.length >= 3)          return 'Moderate';
    return 'Low';
  }

  private deriveModernizationReadiness(recs: Recommendation[]): RecommendationAnalysis['modernizationReadiness'] {
    const arcIssues = recs.filter(r => r.category === 'architecture' && r.priority !== 'low').length;
    const modItems  = recs.filter(r => r.category === 'modernization').length;
    if (arcIssues >= 2)                    return 'Not Ready';
    if (arcIssues >= 1 || modItems >= 3)   return 'Partially Ready';
    return 'Ready';
  }

  private buildDebtContext(
    level: RecommendationAnalysis['technicalDebtLevel'],
    recs: Recommendation[],
  ): string {
    const archCount  = recs.filter(r => r.category === 'architecture').length;
    const debtCount  = recs.filter(r => r.category === 'technical-debt').length;
    const maintCount = recs.filter(r => r.category === 'maintainability').length;
    if (level === 'Critical') return `${archCount} architectural and ${maintCount + debtCount} maintainability issues require prioritised resolution before new feature work adds further complexity.`;
    if (level === 'High')     return 'Structural issues are present that will compound over time if unaddressed. Allocate dedicated refactoring capacity in the next planning cycle.';
    if (level === 'Moderate') return `${recs.length} improvement${recs.length !== 1 ? 's' : ''} identified. Addressable incrementally without blocking feature delivery.`;
    return 'The codebase is well-maintained. Continue applying the same practices.';
  }

  private buildModernizationContext(
    readiness: RecommendationAnalysis['modernizationReadiness'],
    recs: Recommendation[],
  ): string {
    const modItems = recs.filter(r => r.category === 'modernization');
    if (readiness === 'Not Ready')       return 'Architectural issues must be resolved before modernization efforts will be effective.';
    if (readiness === 'Partially Ready') return `${modItems.length} modernization opportunit${modItems.length === 1 ? 'y' : 'ies'} identified. Proceed after resolving high-priority architectural findings.`;
    if (modItems.length > 0)             return `Ready for modernization. ${modItems.length} specific opportunit${modItems.length === 1 ? 'y' : 'ies'} identified.`;
    return 'No modernization blockers detected.';
  }

  private buildModernizationAssessment(
    readiness: RecommendationAnalysis['modernizationReadiness'],
    recs: Recommendation[],
  ): string {
    const modItems = recs.filter(r => r.category === 'modernization');
    const arcItems = recs.filter(r => r.category === 'architecture');
    if (readiness === 'Not Ready') {
      return `Modernization is not advisable at this time. ${arcItems.length} architectural finding${arcItems.length !== 1 ? 's' : ''} indicate the foundation needs stabilisation first. Introducing new patterns on top of structural debt typically increases complexity rather than reducing it.`;
    }
    if (readiness === 'Partially Ready') {
      const top = modItems[0];
      return `The codebase is partially ready for modernization. Resolve high-priority structural findings first.${top ? ` Start with "${top.title}" as the first modernization target once the architectural foundation is stable.` : ''}`;
    }
    if (modItems.length > 0) {
      return `The codebase is ready for modernization. Apply each change independently, verify behaviour, and commit before moving to the next item.`;
    }
    return 'No modernization blockers or specific opportunities were identified. The codebase is stable and ready to adopt modern patterns as opportunities arise.';
  }

  private nodeToCodeRef(node: DependencyNode): CodeReference {
    return {
      fileName: node.path || node.name,
      methodOrClass: node.type !== 'module' ? node.name : undefined,
    };
  }

  private firstFileName(sourceFiles: SourceFile[]): string {
    return sourceFiles[0]?.path.split('/').pop() ?? sourceFiles[0]?.path ?? 'Unknown';
  }
}
