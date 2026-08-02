'use strict';

const { DataFlowDiscoveryEngine } = require('./data-flow-discovery.engine');
const { FolderWorkflowsNarrativeEngine } = require('../narrative/folder-workflows-narrative.engine');

/**
 * DataFlowAnalysisEngine — AI-tier data flow analysis.
 *
 * Wraps DataFlowDiscoveryEngine.discoverWorkflows() and .extractBehaviorInsights()
 * and produces a DataFlowAIAnalysis object used as:
 *   1. model.ai.dataFlow (stored on the workspace)
 *   2. Context fed to the data flow LLM prompt builder
 *
 * This is a heuristic engine — no LLM call. It classifies workflows by risk,
 * identifies structural hotspots, and surfaces all available data flow
 * evidence for downstream LLM reasoning.
 */
class DataFlowAnalysisEngine {

  constructor() {
    this._discovery = new DataFlowDiscoveryEngine();
    this._workflowsNarrative = new FolderWorkflowsNarrativeEngine();
  }

  /**
   * Analyze data flows from a KnowledgeModel.
   *
   * @param {object} model - Full KnowledgeModel passed through adaptModelForEngines
   * @returns {import('../../../../src/app/knowledge/models/data-flow-ai-analysis.model').DataFlowAIAnalysis}
   */
  analyze(model) {
    const graph  = model.relationships?.dependencies?.graph ?? null;
    const struct = model.structure?.folderTree              ?? null;
    const now    = new Date().toISOString();

    if (!graph) {
      return this._empty(now);
    }

    // DataFlowDiscoveryEngine expects a legacy knowledge shape
    const knowledge = { dependencyGraph: graph, sourceFiles: [] };
    const structure = struct ? { root: struct } : undefined;

    let workflows   = [];
    let insights    = { entryPoints: [], mostReferencedServices: [], frequentlyUsedRepositories: [], workflowBottlenecks: [] };

    try {
      workflows = this._discovery.discoverWorkflows(knowledge, structure) ?? [];
    } catch (e) {
      // Non-fatal — proceed with empty workflows
    }

    try {
      insights = this._discovery.extractBehaviorInsights(knowledge) ?? insights;
    } catch (e) {
      // Non-fatal — proceed with empty insights
    }

    const rel = model.relationships ?? {};
    const graphEdges = rel.dependencies?.graph?.edges ?? [];
    const graphNodes = rel.dependencies?.graph?.nodes ?? [];
    const architecturePatterns = (rel.architecture?.patterns ?? []).map(p => p.name);
    const fileCount = Object.keys(model.structure?.symbols ?? {}).length;
    const couplingRatio = graphNodes.length > 0 ? graphEdges.length / graphNodes.length : 0;

    const workflowNames = workflows.map(wf => wf.title ?? wf.name ?? 'Unnamed Workflow');
    let narratives = [];
    try {
      narratives = this._workflowsNarrative.build({
        workflows: workflowNames,
        architecturePatterns,
        fileCount,
        couplingRatio,
      });
    } catch (e) {
      // Non-fatal — proceed without narratives
    }

    const primaryWorkflows = workflows.map((wf, i) =>
      this._profileWorkflow(wf, insights, narratives[i] ?? null),
    );

    return {
      workflowCount:        workflows.length,
      primaryWorkflows,
      entryPoints:          insights.entryPoints          ?? [],
      bottlenecks:          insights.workflowBottlenecks  ?? [],
      externalDependencies: this._detectExternalDeps(graph),
      mostReferenced:       insights.mostReferencedServices ?? [],
      dataAccessNodes:      insights.frequentlyUsedRepositories ?? [],
      generatedAt:          now,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _empty(now) {
    return {
      workflowCount:        0,
      primaryWorkflows:     [],
      entryPoints:          [],
      bottlenecks:          [],
      externalDependencies: [],
      mostReferenced:       [],
      dataAccessNodes:      [],
      generatedAt:          now,
    };
  }

  /**
   * Build a WorkflowRiskProfile from a discovered WorkflowSummary.
   * Risk is assessed from step count, bottleneck presence, and workflow confidence.
   */
  _profileWorkflow(wf, insights, narrative) {
    const bottlenecksInPath = (wf.flowPath ?? []).filter(
      node => (insights.workflowBottlenecks ?? []).includes(node),
    );

    const failureRisk = this._rateWorkflowRisk(
      wf.steps?.length ?? 0,
      bottlenecksInPath.length,
      wf.confidence,
    );

    return {
      workflowName:     wf.title    ?? wf.name ?? 'Unnamed Workflow',
      entryPoint:       wf.flowPath?.[0] ?? '',
      stepCount:        wf.steps?.length ?? wf.flowPath?.length ?? 0,
      bottleneckNodes:  bottlenecksInPath,
      failureRisk,
      ...(narrative ? { narrative } : {}),
    };
  }

  _rateWorkflowRisk(stepCount, bottleneckCount, confidence) {
    const score =
      (stepCount      >= 6 ? 2 : stepCount      >= 4 ? 1 : 0) +
      (bottleneckCount >= 2 ? 2 : bottleneckCount >= 1 ? 1 : 0) +
      (confidence      <  0.65 ? 1 : 0);

    if (score >= 4) return 'High';
    if (score >= 2) return 'Moderate';
    return 'Low';
  }

  /**
   * Detect nodes that look like external service integrations
   * (HTTP clients, API gateways, third-party connectors).
   */
  _detectExternalDeps(graph) {
    if (!graph?.nodes?.length) return [];

    const EXTERNAL_PATTERNS = [
      /client/i, /gateway/i, /provider/i, /adapter/i,
      /proxy/i, /connector/i, /integration/i, /webhook/i, /http/i,
    ];

    return graph.nodes
      .filter(n => EXTERNAL_PATTERNS.some(p => p.test(n.name ?? '')))
      .map(n => n.name)
      .slice(0, 8);
  }
}

module.exports = { DataFlowAnalysisEngine };
