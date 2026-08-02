// Types from: @app/analysis/models/recommendation-analysis.model
export interface CodeReference {
  fileName: string;
  methodOrClass?: string;
}

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationCategory = 'architecture' | 'modernization' | 'performance' | 'reliability' | 'complexity' | 'technical-debt' | 'maintainability' | 'security';

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
  dependenciesAffected: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

export interface RecommendationAnalysis {
  overview: string;
  criticalCount: number;
  highCount: number;
  technicalDebtLevel: 'Critical' | 'High' | 'Moderate' | 'Low';
  debtContext: string;
  modernizationReadiness: 'Not Ready' | 'Partially Ready' | 'Ready';
  modernizationContext: string;
  recommendations: Recommendation[];
  improvementThemes: string[];
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

// Types from analysis session / ai models
export interface AiRisk {
  title: string;
  description: string;
  severity: string;
}

export interface ModernizationRecommendation {
  title: string;
  description: string;
}

export interface AnalysisSession {
  fileName: string;
  sourceCode?: string;
  analysis: {
    risks?: { description: string; severity: string }[];
    modernizationSuggestions?: ModernizationRecommendation[];
  };
  aiAnalysis?: {
    risks?: AiRisk[];
    modernizations?: ModernizationRecommendation[];
    summary?: string;
  };
  workspaceContext?: any;
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

  analyzeFile(session: AnalysisSession): RecommendationAnalysis {
    const recs: Omit<Recommendation, 'priorityRank'>[] = [];
    const fileName = session.fileName;

    if (session.aiAnalysis?.risks?.length) {
      session.aiAnalysis.risks.forEach((r: AiRisk, i: number) => {
        const sev = r.severity?.toLowerCase() ?? 'medium';
        recs.push({
          id: `risk-${i}`,
          title: r.title,
          priorityScore: this.severityToScore(sev),
          priority: this.severityToPriority(sev),
          category: this.inferCategory(r.title, r.description, 'maintainability'),
          affectedArea: this.inferAffectedArea(r.title, r.description),
          affectedFiles: [fileName],
          codeReference: { fileName },
          issueDescription: r.description,
          whyItMatters: this.deriveWhyItMatters(r.title, r.description),
          recommendedImprovement: this.deriveImprovement(r.title, r.description),
          expectedImpact: this.deriveExpectedImpact(r.title, sev),
          dependenciesAffected: [],
          riskLevel: this.severityToRisk(sev),
        });
      });
    } else if (session.analysis.risks?.length) {
      session.analysis.risks.forEach((r: { description: string; severity: string }, i: number) => {
        const sev = r.severity?.toLowerCase() ?? 'medium';
        recs.push({
          id: `risk-${i}`,
          title: r.description,
          priorityScore: this.severityToScore(sev),
          priority: this.severityToPriority(sev),
          category: 'maintainability',
          affectedArea: 'Code Quality',
          affectedFiles: [fileName],
          codeReference: { fileName },
          issueDescription: r.description,
          whyItMatters: this.deriveWhyItMatters(r.description, r.description),
          recommendedImprovement: 'Review and address the identified risk using current best practices.',
          expectedImpact: 'Reduced technical debt and improved maintainability.',
          dependenciesAffected: [],
          riskLevel: this.severityToRisk(sev),
        });
      });
    }

    if (session.aiAnalysis?.modernizations?.length) {
      session.aiAnalysis.modernizations.forEach((m: ModernizationRecommendation, i: number) => {
        recs.push({
          id: `modern-${i}`,
          title: m.title,
          priorityScore: 30,
          priority: 'low',
          category: 'modernization',
          affectedArea: 'Modernization',
          affectedFiles: [fileName],
          codeReference: { fileName },
          issueDescription: m.description,
          whyItMatters: 'Modernizing this pattern reduces maintenance overhead and aligns with current platform capabilities.',
          recommendedImprovement: m.description,
          expectedImpact: 'Improved developer experience and reduced long-term maintenance cost.',
          dependenciesAffected: [],
          riskLevel: 'low',
        });
      });
    }

    return this.buildAnalysis(recs, session.fileName);
  }

  analyzeKnowledge(knowledge: RepositoryKnowledge, session: AnalysisSession | null): RecommendationAnalysis {
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

      // High-coupling hubs
      const hubs = graph.nodes
        .filter(n => (inbound.get(n.id) ?? 0) >= 5)
        .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0));

      for (const hub of hubs.slice(0, 3)) {
        const deps = inbound.get(hub.id) ?? 0;
        const sev = deps >= 10 ? 'high' : 'medium';
        recs.push({
          id: `coupling-${hub.id}`,
          title: `High Coupling: ${hub.name}`,
          priorityScore: deps >= 10 ? 80 : 60,
          priority: this.severityToPriority(sev),
          category: 'architecture',
          affectedArea: 'Dependency Management',
          affectedFiles: [hub.name],
          codeReference: this.nodeToCodeRef(hub),
          issueDescription: `${hub.name} has ${deps} direct dependents. Changes to this file propagate risk to ${deps} other modules.`,
          whyItMatters: `A module with ${deps} dependents becomes a single point of failure. Any bug or breaking change forces cascading fixes across ${deps} files, multiplying review and test effort.`,
          recommendedImprovement: `Extract the cohesive responsibilities from ${hub.name} into smaller, focused modules. Introduce an interface or abstraction layer so consumers depend on the abstraction rather than the concrete implementation. This limits blast radius to the abstraction boundary.`,
          expectedImpact: `Reduced cascade risk; changes to ${hub.name} affect only direct consumers of the abstraction, not all ${deps} callers.`,
          dependenciesAffected: graph.nodes
            .filter(n => graph.edges.some(e => e.target === hub.id && e.source === n.id))
            .slice(0, 5)
            .map(n => n.name),
          riskLevel: this.severityToRisk(sev),
        });
      }

      // Circular dependencies
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
          issueDescription: `${mutual.length} module(s) have mutual import references, creating circular dependency chains.`,
          whyItMatters: 'Circular dependencies cause initialization order failures at runtime, break tree-shaking in bundlers, and make it impossible to load or test modules in isolation.',
          recommendedImprovement: 'Break cycles by introducing a shared model or interface module that both parties can import without importing each other. Apply Dependency Inversion — both modules depend on the abstraction, neither on the other concrete module.',
          expectedImpact: 'Elimination of initialization failures; bundler tree-shaking becomes possible; isolated unit testing enabled.',
          dependenciesAffected: mutual.slice(0, 5).map(id => graph.nodes.find(n => n.id === id)?.name ?? id),
          riskLevel: 'high',
        });
      }

      // No architecture pattern
      if (graph.nodes.length > 20 && !architecture?.patterns.length) {
        recs.push({
          id: 'no-pattern',
          title: 'No Clear Architecture Pattern',
          priorityScore: 50,
          priority: 'medium',
          category: 'architecture',
          affectedArea: 'Structural Organization',
          affectedFiles: [primaryFile],
          codeReference: { fileName: primaryFile },
          issueDescription: `${graph.nodes.length} files exist with no dominant architecture pattern detected.`,
          whyItMatters: 'Without a consistent structure, every developer builds their own mental model of the codebase. Onboarding time increases and the probability of inconsistent implementations grows with team size.',
          recommendedImprovement: 'Choose an architecture pattern (layered, feature-based, or domain-driven) appropriate for this codebase. Organize existing files into clearly named folders (services/, models/, components/). Document the chosen pattern so new contributors can follow it.',
          expectedImpact: 'Faster onboarding; consistent module placement; reduced cognitive overhead for all contributors.',
          dependenciesAffected: [],
          riskLevel: 'medium',
        });
      }

      // Isolated files
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
          dependenciesAffected: [],
          riskLevel: 'low',
        });
      }

      // Broad scope modules
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
          affectedFiles: [node.name],
          codeReference: this.nodeToCodeRef(node),
          issueDescription: `${node.name} imports ${deps} other modules, indicating it spans multiple concerns.`,
          whyItMatters: 'A module that depends on many others is difficult to test in isolation and likely violates the Single Responsibility Principle. It becomes the "God module" — everything depends on it indirectly.',
          recommendedImprovement: `Decompose ${node.name} by concern. Separate data-fetching logic from transformation logic. Extract UI state from business logic. Each resulting module should have one clear reason to change.`,
          expectedImpact: 'Improved testability; each concern can be modified independently; reduced compilation cascade on changes.',
          dependenciesAffected: graph.edges
            .filter(e => e.source === node.id)
            .slice(0, 5)
            .map(e => graph.nodes.find(n => n.id === e.target)?.name ?? e.target),
          riskLevel: 'medium',
        });
      }
    }

    // Mixed architecture patterns
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
          affectedFiles: [primaryFile],
          codeReference: { fileName: primaryFile },
          issueDescription: `Low-confidence pattern detection: ${lowConfidence.map(p => p.name).join(', ')}. Multiple conflicting patterns exist in the same codebase.`,
          whyItMatters: 'Inconsistent patterns force every developer to context-switch between mental models. The cost is invisible but compounds: each new file placement becomes a judgment call with no right answer.',
          recommendedImprovement: 'Choose a primary pattern and migrate inconsistent areas incrementally. Start with a short architecture decision record (ADR) documenting the chosen pattern and migration strategy. New code should follow the standard; existing code migrates opportunistically during feature work.',
          expectedImpact: 'Consistent file placement; reduced review friction; faster onboarding for new team members.',
          dependenciesAffected: [],
          riskLevel: 'medium',
        });
      }
    }

    // AI-sourced items from session
    const ai = session?.aiAnalysis;
    if (ai?.risks?.length) {
      ai.risks.forEach((r: AiRisk, i: number) => {
        if (!recs.some(rec => rec.title === r.title)) {
          const sev = r.severity?.toLowerCase() ?? 'medium';
          recs.push({
            id: `ai-risk-${i}`,
            title: r.title,
            priorityScore: this.severityToScore(sev),
            priority: this.severityToPriority(sev),
            category: this.inferCategory(r.title, r.description, 'maintainability'),
            affectedArea: this.inferAffectedArea(r.title, r.description),
            affectedFiles: [primaryFile],
            codeReference: { fileName: primaryFile },
            issueDescription: r.description,
            whyItMatters: this.deriveWhyItMatters(r.title, r.description),
            recommendedImprovement: this.deriveImprovement(r.title, r.description),
            expectedImpact: this.deriveExpectedImpact(r.title, sev),
            dependenciesAffected: [],
            riskLevel: this.severityToRisk(sev),
          });
        }
      });
    }
    if (ai?.modernizations?.length) {
      ai.modernizations.forEach((m: ModernizationRecommendation, i: number) => {
        if (!recs.some(rec => rec.title === m.title)) {
          recs.push({
            id: `ai-modern-${i}`,
            title: m.title,
            priorityScore: 30,
            priority: 'low',
            category: 'modernization',
            affectedArea: 'Modernization',
            affectedFiles: [primaryFile],
            codeReference: { fileName: primaryFile },
            issueDescription: m.description,
            whyItMatters: 'Modernizing this pattern reduces maintenance overhead and aligns with current platform capabilities.',
            recommendedImprovement: m.description,
            expectedImpact: 'Improved developer experience and reduced long-term maintenance cost.',
            dependenciesAffected: [],
            riskLevel: 'low',
          });
        }
      });
    }

    return this.buildAnalysis(recs, primaryFile);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildAnalysis(
    recs: Omit<Recommendation, 'priorityRank'>[],
    primaryFile: string,
  ): RecommendationAnalysis {
    const sorted = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
    const ranked: Recommendation[] = sorted.map((r, i) => ({ ...r, priorityRank: i + 1 }));

    const criticalCount = ranked.filter(r => r.priority === 'critical').length;
    const highCount     = ranked.filter(r => r.priority === 'high').length;
    const totalScore    = ranked.reduce((s, r) => s + r.priorityScore, 0);
    const avgScore      = ranked.length > 0 ? totalScore / ranked.length : 0;

    const debtLevel = this.deriveDebtLevel(ranked);
    const modReadiness = this.deriveModernizationReadiness(ranked);

    return {
      overview: this.buildOverview(ranked, primaryFile, criticalCount, highCount),
      criticalCount,
      highCount,
      technicalDebtLevel: debtLevel,
      debtContext: this.buildDebtContext(debtLevel, ranked),
      modernizationReadiness: modReadiness,
      modernizationContext: this.buildModernizationContext(modReadiness, ranked),
      recommendations: ranked,
      improvementThemes: this.deriveThemes(ranked),
      modernizationAssessment: this.buildModernizationAssessment(modReadiness, ranked, primaryFile),
      generatedAt: new Date().toISOString(),
    };
  }

  private deriveDebtLevel(recs: Recommendation[]): RecommendationAnalysis['technicalDebtLevel'] {
    const critical = recs.filter(r => r.priority === 'critical').length;
    const high     = recs.filter(r => r.priority === 'high').length;
    if (critical > 0 || high >= 3)     return 'Critical';
    if (high >= 1)                     return 'High';
    if (recs.length >= 3)              return 'Moderate';
    return 'Low';
  }

  private deriveModernizationReadiness(recs: Recommendation[]): RecommendationAnalysis['modernizationReadiness'] {
    const arcIssues  = recs.filter(r => r.category === 'architecture' && r.riskLevel !== 'low').length;
    const modItems   = recs.filter(r => r.category === 'modernization').length;
    if (arcIssues >= 2) return 'Not Ready';
    if (arcIssues >= 1 || modItems >= 3) return 'Partially Ready';
    return 'Ready';
  }

  private buildOverview(
    recs: Recommendation[],
    primaryFile: string,
    criticalCount: number,
    highCount: number,
  ): string {
    if (recs.length === 0) {
      return `Analysis of ${primaryFile} found no actionable improvements at this time. The codebase is in a healthy state for its current scope.`;
    }
    const topPriority = recs[0];
    const urgencyPhrase = criticalCount > 0
      ? `${criticalCount} critical item${criticalCount > 1 ? 's' : ''} requiring immediate attention`
      : highCount > 0
      ? `${highCount} high-priority item${highCount > 1 ? 's' : ''} that should be addressed soon`
      : `${recs.length} improvement${recs.length > 1 ? 's' : ''} identified`;
    return `Analysis identified ${urgencyPhrase}. The highest-priority finding is "${topPriority.title}" — ${topPriority.issueDescription.split('.')[0]}. ${recs.length > 1 ? `A total of ${recs.length} recommendations are ranked below by priority score.` : ''}`.trim();
  }

  private buildDebtContext(
    level: RecommendationAnalysis['technicalDebtLevel'],
    recs: Recommendation[],
  ): string {
    const archCount   = recs.filter(r => r.category === 'architecture').length;
    const debtCount   = recs.filter(r => r.category === 'technical-debt').length;
    const maintCount  = recs.filter(r => r.category === 'maintainability').length;
    if (level === 'Critical') return `Critical debt level: ${archCount} architectural and ${maintCount + debtCount} maintainability issues require prioritized resolution before new feature work adds further complexity.`;
    if (level === 'High')     return `High debt level: structural issues are present that will compound over time if unaddressed. Allocate dedicated refactoring capacity in the next planning cycle.`;
    if (level === 'Moderate') return `Moderate debt level: ${recs.length} improvement${recs.length > 1 ? 's' : ''} identified. Addressable incrementally without blocking feature delivery.`;
    return 'Low debt level: the codebase is well-maintained. Continue applying the same practices.';
  }

  private buildModernizationContext(
    readiness: RecommendationAnalysis['modernizationReadiness'],
    recs: Recommendation[],
  ): string {
    const modItems = recs.filter(r => r.category === 'modernization');
    if (readiness === 'Not Ready')         return 'Architectural issues must be resolved before modernization efforts will be effective. Attempting to modernize on an unstable foundation increases risk.';
    if (readiness === 'Partially Ready')   return `${modItems.length} modernization opportunit${modItems.length === 1 ? 'y' : 'ies'} identified. Proceed after resolving high-priority architectural findings.`;
    if (modItems.length > 0)               return `Ready for modernization. ${modItems.length} specific opportunit${modItems.length === 1 ? 'y' : 'ies'} identified to adopt current platform patterns.`;
    return 'No modernization blockers detected. The codebase is ready for incremental adoption of modern patterns as opportunities arise.';
  }

  private buildModernizationAssessment(
    readiness: RecommendationAnalysis['modernizationReadiness'],
    recs: Recommendation[],
    primaryFile: string,
  ): string {
    const modItems = recs.filter(r => r.category === 'modernization');
    const arcItems = recs.filter(r => r.category === 'architecture');
    if (readiness === 'Not Ready') {
      return `Modernization is not advisable at this time. ${arcItems.length} architectural finding${arcItems.length !== 1 ? 's' : ''} indicate that the codebase foundation needs stabilization first. Introducing new patterns on top of structural debt typically increases complexity rather than reducing it. Address the architecture recommendations — particularly any coupling or circular dependency issues — before investing in modernization.`;
    }
    if (readiness === 'Partially Ready') {
      const top = modItems[0];
      return `The codebase is partially ready for modernization. High-priority structural findings should be resolved first, after which the ${modItems.length} modernization items can be applied safely. ${top ? `Start with "${top.title}" as the first modernization target once the architectural foundation is stable.` : ''}`.trim();
    }
    if (modItems.length > 0) {
      return `The codebase is ready for modernization. ${modItems.length} specific opportunit${modItems.length === 1 ? 'y has' : 'ies have'} been identified. Approach modernization incrementally — apply each change independently, verify behavior, and commit before moving to the next item. This reduces rollback scope if any change introduces unexpected behavior.`;
    }
    return 'No modernization blockers or specific opportunities were identified in this analysis. The codebase is in a stable state and ready to adopt modern patterns as the codebase evolves.';
  }

  private deriveThemes(recs: Recommendation[]): string[] {
    const themes: string[] = [];
    const categories = new Set(recs.map(r => r.category));

    if (categories.has('architecture')) {
      const count = recs.filter(r => r.category === 'architecture').length;
      themes.push(`Structural improvement: ${count} architecture finding${count > 1 ? 's' : ''} indicate module boundary and coupling issues`);
    }
    if (categories.has('complexity')) {
      themes.push('Complexity reduction: modules with high outbound dependencies should be decomposed by concern');
    }
    if (categories.has('maintainability')) {
      themes.push('Maintainability: code quality and readability issues identified that increase maintenance cost over time');
    }
    if (categories.has('modernization')) {
      const count = recs.filter(r => r.category === 'modernization').length;
      themes.push(`Modernization: ${count} opportunit${count === 1 ? 'y' : 'ies'} to adopt current platform patterns`);
    }
    if (categories.has('technical-debt')) {
      themes.push('Technical debt: identified unused or isolated code that should be reviewed and cleaned up');
    }
    if (categories.has('reliability')) {
      themes.push('Reliability: error handling or resilience patterns need attention');
    }
    if (categories.has('performance')) {
      themes.push('Performance: opportunities to reduce computational overhead identified');
    }

    return themes.slice(0, 5);
  }

  private nodeToCodeRef(node: DependencyNode): CodeReference {
    const fileName = node.path || node.name;
    return {
      fileName,
      methodOrClass: node.type !== 'module' ? node.name : undefined,
    };
  }

  private firstFileName(sourceFiles: SourceFile[]): string {
    return sourceFiles[0]?.path.split('/').pop() ?? sourceFiles[0]?.path ?? 'Unknown';
  }

  private severityToScore(sev: string): number {
    return ({ critical: 95, high: 75, medium: 50, low: 30, info: 20 } as Record<string, number>)[sev] ?? 40;
  }

  private severityToPriority(sev: string): RecommendationPriority {
    return ({ critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'low' } as Record<string, RecommendationPriority>)[sev] ?? 'medium';
  }

  private severityToRisk(sev: string): Recommendation['riskLevel'] {
    return ({ critical: 'high', high: 'high', medium: 'medium', low: 'low', info: 'low' } as Record<string, Recommendation['riskLevel']>)[sev] ?? 'medium';
  }

  private inferCategory(title: string, desc: string, fallback: RecommendationCategory): RecommendationCategory {
    const text = `${title} ${desc}`.toLowerCase();
    if (/architect|structure|pattern|layer|module boundary/.test(text))   return 'architecture';
    if (/modern|upgrade|migrate|deprecat|outdated/.test(text))            return 'modernization';
    if (/coupling|circular|depend/.test(text))                            return 'architecture';
    if (/performance|slow|memory|cache|optimiz/.test(text))               return 'performance';
    if (/reliability|error|exception|resilience|fault/.test(text))        return 'reliability';
    if (/complex|cognitive|readab/.test(text))                            return 'complexity';
    if (/debt|dead code|unused|legacy/.test(text))                        return 'technical-debt';
    return fallback;
  }

  private inferAffectedArea(title: string, desc: string): string {
    const text = `${title} ${desc}`.toLowerCase();
    if (/auth|credential|secret|token|password/.test(text))               return 'Authentication / Authorization';
    if (/error|exception/.test(text))                                      return 'Error Handling';
    if (/perform|slow|latency/.test(text))                                 return 'Performance';
    if (/test|coverage/.test(text))                                        return 'Testability';
    if (/depend|import/.test(text))                                        return 'Dependency Management';
    if (/config|env|setting/.test(text))                                   return 'Configuration';
    if (/logging|observ|monitor/.test(text))                               return 'Observability';
    return 'Code Quality';
  }

  private deriveWhyItMatters(title: string, desc: string): string {
    const text = `${title} ${desc}`.toLowerCase();
    if (/coupling|depend/.test(text)) return 'Tightly coupled modules amplify the blast radius of every change — a fix in one place requires fixes in many others.';
    if (/error|exception/.test(text)) return 'Unhandled errors in production cause silent failures that are harder to diagnose than explicit, handled error states.';
    if (/perform/.test(text))         return 'Performance issues in hot paths degrade user experience and increase infrastructure cost at scale.';
    if (/test/.test(text))            return 'Code that is hard to test accumulates hidden regressions over time.';
    return 'Addressing this finding reduces maintenance burden and prevents the issue from compounding as the codebase evolves.';
  }

  private deriveImprovement(title: string, desc: string): string {
    const text = `${title} ${desc}`.toLowerCase();
    if (/coupling/.test(text))       return 'Introduce an abstraction layer between the tightly coupled modules. Consumers should depend on the interface, not the concrete implementation.';
    if (/circular/.test(text))       return 'Extract shared data types or interfaces into a dedicated model module that both parties import. Neither module should import the other.';
    if (/error/.test(text))          return 'Add explicit error boundaries at the call sites. Log errors with sufficient context to diagnose the failure without a debugger.';
    if (/perform/.test(text))        return 'Profile the affected code path to identify the bottleneck. Apply targeted optimization — avoid premature optimization in unverified hot paths.';
    return 'Review the affected code and apply the appropriate pattern from current best practices. Verify the change with targeted tests before merging.';
  }

  private deriveExpectedImpact(title: string, sev: string): string {
    const score = this.severityToScore(sev);
    if (score >= 75) return 'High impact: resolving this finding significantly reduces risk and prevents compounding debt.';
    if (score >= 50) return 'Moderate impact: addressing this finding improves maintainability and reduces future friction.';
    return 'Low impact: this is an incremental improvement that improves code quality over time.';
  }
}
