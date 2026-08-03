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
    const dataFlowFacts = model.relationships?.dataFlowFacts ?? null;
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
      console.error('[DataFlowAnalysis] extractBehaviorInsights failed:', e?.message ?? e);
    }

    // Normalize workflow shape: discovery engine uses .nodes[] and .connections[],
    // not .flowPath[] and .steps[]. Fix so _profileWorkflow reads the right fields.
    workflows = workflows.map(wf => ({
      ...wf,
      flowPath: wf.nodes?.map(n => n.name) ?? [],
      steps:    wf.nodes ?? [],
    }));

    const rel = model.relationships ?? {};
    const graphEdges = rel.dependencies?.graph?.edges ?? [];
    const graphNodes = rel.dependencies?.graph?.nodes ?? [];
    const architecturePatterns = (rel.architecture?.patterns ?? []).map(p => p.name);
    const fileCount = Object.keys(model.structure?.symbols ?? {}).length;
    const couplingRatio = graphNodes.length > 0 ? graphEdges.length / graphNodes.length : 0;

    // Build preliminary profiles first so the narrative engine has step counts,
    // entry points, bottlenecks, and risk — enabling per-workflow specific text.
    const preliminaryProfiles = workflows.map(wf =>
      this._profileWorkflow(wf, insights, null, dataFlowFacts),
    );

    let narratives = [];
    try {
      narratives = this._workflowsNarrative.build({
        workflows: preliminaryProfiles.map(p => ({
          name:            p.workflowName,
          entryPoint:      p.entryPoint,
          stepCount:       p.stepCount,
          bottleneckNodes: p.bottleneckNodes,
          failureRisk:     p.failureRisk,
        })),
        architecturePatterns,
        fileCount,
        couplingRatio,
      });
    } catch (e) {
      // Non-fatal — proceed without narratives
    }

    const primaryWorkflows = preliminaryProfiles.map((profile, i) =>
      narratives[i] ? { ...profile, narrative: narratives[i] } : profile,
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
   * Build a WorkflowRiskProfile from a discovered workflow.
   * Risk is assessed from step count, bottleneck presence, and workflow confidence.
   * Enriches connections with semantic verbs from dataFlowFacts when available.
   */
  _profileWorkflow(wf, insights, narrative, dataFlowFacts) {
    const bottlenecksInPath = (wf.flowPath ?? []).filter(
      node => (insights.workflowBottlenecks ?? []).includes(node),
    );

    const failureRisk = this._rateWorkflowRisk(
      wf.steps?.length ?? 0,
      bottlenecksInPath.length,
      wf.confidence,
    );

    const enrichedConnections = (wf.connections ?? []).map(c => ({
      sourceId: c.sourceId,
      targetId: c.targetId,
      verb: this._enrichConnectionVerb(c, dataFlowFacts),
    }));

    return {
      workflowName:     wf.title    ?? wf.name ?? 'Unnamed Workflow',
      entryPoint:       wf.flowPath?.[0] ?? '',
      stepCount:        wf.steps?.length ?? wf.flowPath?.length ?? 0,
      bottleneckNodes:  bottlenecksInPath,
      failureRisk,
      ...(narrative ? { narrative } : {}),
      ...(enrichedConnections.length ? { enrichedConnections } : {}),
    };
  }

  /**
   * Resolve the interaction verb for a connection using dataFlowFacts.
   * Falls back to the connection's existing relationshipType, then 'calls'.
   */
  _enrichConnectionVerb(connection, dataFlowFacts) {
    if (!dataFlowFacts?.length) return connection.relationshipType ?? 'calls';

    // Find the fact for the source file (node IDs are normalized paths)
    const fact = dataFlowFacts.find(f =>
      connection.sourceId?.endsWith(f.path) || f.path?.endsWith(connection.sourceId),
    );
    if (!fact) return connection.relationshipType ?? 'calls';

    // Look up the verb by matching the target against the fact's interactionVerbs keys
    const targetBase = (connection.targetId ?? '').split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';

    for (const [importPath, verb] of Object.entries(fact.interactionVerbs)) {
      const importBase = importPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      if (
        importBase === targetBase ||
        importPath.endsWith(connection.targetId) ||
        connection.targetId?.endsWith(importPath)
      ) {
        return verb;
      }
    }

    return connection.relationshipType ?? 'calls';
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
