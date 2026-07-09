'use strict';

const { RepositoryInsightsEngine } = require('../analysis/repository-insights.engine');
const { DataFlowDiscoveryEngine } = require('../analysis/data-flow-discovery.engine');
const { WorkflowExplorerEngine } = require('../analysis/workflow-explorer.engine');
const { RepositorySummaryEngine } = require('../analysis/repository-summary.engine');

/**
 * ContextGenerationEngine — D5
 *
 * Transforms a KnowledgeModel into feature-specific context objects.
 * Consumers (AI, docs, architecture, learning paths, recommendations)
 * call this engine instead of re-deriving context from raw source files.
 *
 * Context types produced:
 *   - repository  →  RepositoryExplanationContext  (AI repository explanation)
 *   - workflow    →  WorkflowExplanationContext     (AI workflow explanation)
 *   - security    →  SecurityOverviewContext        (AI security narrative)
 *   - analysis    →  AnalysisContext                (SystemUnderstanding / Recs / LearningPath)
 */
class ContextGenerationEngine {

  constructor() {
    this.insightsEngine   = new RepositoryInsightsEngine();
    this.dataFlowEngine   = new DataFlowDiscoveryEngine();
    this.workflowEngine   = new WorkflowExplorerEngine();
    this.summaryEngine    = new RepositorySummaryEngine();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build context for any feature type.
   *
   * @param {'repository'|'workflow'|'security'|'analysis'} contextType
   * @param {object} knowledgeModel   Output of KnowledgeModelEngine.build()
   * @param {object} [extras]         Feature-specific supplemental data
   *   - repository: { workspaceName? }
   *   - workflow:   { workflow (WorkflowSummary), workspaceName? }
   *   - security:   { securityAnalysis, scope, workspaceName? }
   *   - analysis:   {}
   * @returns {object}
   */
  build(contextType, knowledgeModel, extras = {}) {
    switch (contextType) {
      case 'repository': return this.buildRepositoryContext(knowledgeModel, extras);
      case 'workflow':   return this.buildWorkflowContext(knowledgeModel, extras);
      case 'security':   return this.buildSecurityContext(knowledgeModel, extras);
      case 'analysis':   return this.buildAnalysisContext(knowledgeModel);
      default: throw new Error(`Unknown contextType: ${contextType}`);
    }
  }

  // ── Repository context ────────────────────────────────────────────────────

  buildRepositoryContext(model, extras) {
    const workspaceName  = extras.workspaceName ?? model.workspaceName ?? 'Repository';
    const workspaceType  = this.inferWorkspaceType(model);

    // Derive workflows from the knowledge model's dependency graph + folder structure
    const flows     = this.dataFlowEngine.discoverWorkflows(
      { sourceFiles: model.sourceFiles, dependencyGraph: model.dependencyGraph },
      model.folderStructure ?? null,
    );
    const workflows = this.workflowEngine.buildSummaries(flows ?? []);

    // Derive insights from the knowledge model
    const insights = this.insightsEngine.analyze({
      sourceFiles:     model.sourceFiles,
      dependencyGraph: model.dependencyGraph ?? null,
      architecture:    model.architecture ?? null,
      builtAt:         model.builtAt,
    });

    // Derive summary for executiveSummary and keyFiles
    const workspaceContext = this.toWorkspaceContext(model, workspaceName);
    const summary = this.summaryEngine.build(workspaceContext, {
      sourceFiles:     model.sourceFiles,
      dependencyGraph: model.dependencyGraph ?? null,
      architecture:    model.architecture ?? null,
      builtAt:         model.builtAt,
    }, null);

    const architecturePatterns = (model.architecture?.patterns ?? []).map(p => ({
      name:       p.name,
      confidence: p.confidence ?? 0,
      indicators: p.indicators ?? [],
    }));

    const dependencyGraph = model.dependencyGraph ?? null;

    return {
      workspaceName,
      workspaceType,
      languages:    model.languages ?? [],
      technologies: (model.detectedTechnologies ?? []).map(t => t.name ?? t.technology ?? '').filter(Boolean),
      totalFiles:   model.sourceFiles?.length ?? 0,
      projectNames: (model.projects ?? []).map(p => p.name).filter(Boolean),
      architecturePatterns,
      topWorkflows:    workflows.slice(0, 5),
      insights:        insights.slice(0, 8).map(i => ({
        title:       i.title,
        description: i.description,
        severity:    i.severity,
        category:    i.category,
      })),
      keyFiles:        (summary.keyFiles ?? []).slice(0, 8).map(kf => ({ name: kf.name, reason: kf.reason })),
      executiveSummary: summary.executiveSummary ?? null,
      dependencyStats: dependencyGraph
        ? { nodes: dependencyGraph.nodes?.length ?? 0, edges: dependencyGraph.edges?.length ?? 0 }
        : undefined,
    };
  }

  // ── Workflow context ──────────────────────────────────────────────────────

  buildWorkflowContext(model, extras) {
    if (!extras.workflow) throw new Error('extras.workflow is required for workflow context');

    const workspaceName = extras.workspaceName ?? model.workspaceName ?? 'Repository';
    const workflow      = extras.workflow;
    const graphNodes    = model.dependencyGraph?.nodes ?? [];

    const relatedNodeNames = (workflow.flowPath ?? [])
      .map(name => graphNodes.find(n => n.name === name || n.id === name)?.name ?? name)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    const architecturePatterns = (model.architecture?.patterns ?? []).map(p => p.name);

    return {
      workspaceName,
      workflow,
      relatedNodeNames,
      architecturePatterns,
    };
  }

  // ── Security context ──────────────────────────────────────────────────────

  buildSecurityContext(model, extras) {
    if (!extras.securityAnalysis) throw new Error('extras.securityAnalysis is required for security context');

    const workspaceName = extras.workspaceName ?? model.workspaceName ?? 'Repository';
    const scope         = extras.scope ?? model.targetType ?? 'repository';

    return {
      workspaceName,
      languages:            model.languages ?? [],
      technologies:         (model.detectedTechnologies ?? []).map(t => t.name ?? t.technology ?? '').filter(Boolean),
      architecturePatterns: (model.architecture?.patterns ?? []).map(p => p.name),
      security:             extras.securityAnalysis,
      scope,
    };
  }

  // ── Analysis context ──────────────────────────────────────────────────────
  // Used by SystemUnderstanding, Recommendations, and LearningPath engines.
  // Provides a flattened view of the Knowledge Model without needing to
  // understand its internal structure.

  buildAnalysisContext(model) {
    return {
      targetType:    model.targetType,
      languages:     model.languages ?? [],
      technologies:  (model.detectedTechnologies ?? []).map(t => t.name ?? t.technology ?? '').filter(Boolean),
      frameworks:    model.frameworks ?? [],
      totalFiles:    model.sourceFiles?.length ?? 0,
      projects:      (model.projects ?? []).map(p => ({ name: p.name, type: p.type, framework: p.framework })),
      architecturePatterns: (model.architecture?.patterns ?? []).map(p => p.name),
      dependencyEdgeCount:  model.dependencyGraph?.edges?.length ?? 0,
      dependencyNodeCount:  model.dependencyGraph?.nodes?.length ?? 0,
      symbolCounts: this.deriveSymbolCounts(model.symbolIndex ?? {}),
      gitAnalysis:  model.gitAnalysis ?? null,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  inferWorkspaceType(model) {
    if (model.targetType === 'repository') return 'Repository';
    if (model.targetType === 'folder') return 'MultiFile';
    return 'SingleFile';
  }

  toWorkspaceContext(model, workspaceName) {
    return {
      workspaceName,
      profile: {
        workspaceType:        this.inferWorkspaceType(model),
        totalFiles:           model.sourceFiles?.length ?? 0,
        languages:            model.languages ?? [],
        technologies:         (model.detectedTechnologies ?? []).map(t => t.name ?? t.technology ?? '').filter(Boolean),
        detectedTechnologies: model.detectedTechnologies ?? [],
        repositoryStructure:  model.folderStructure ?? null,
        files: (model.parsedFiles ?? []).map(pf => ({
          name: pf.name,
          path: pf.path,
          extension: pf.extension ?? '',
          language: pf.language ?? 'Unknown',
          size: 0,
        })),
      },
      uploadedAt: new Date(model.builtAt),
    };
  }

  deriveSymbolCounts(symbolIndex) {
    let classes = 0, methods = 0, imports = 0;
    for (const entry of Object.values(symbolIndex)) {
      classes += entry.classes?.length ?? 0;
      methods += entry.methods?.length ?? 0;
      imports += entry.imports?.length ?? 0;
    }
    return { classes, methods, imports };
  }
}

module.exports = { ContextGenerationEngine };
