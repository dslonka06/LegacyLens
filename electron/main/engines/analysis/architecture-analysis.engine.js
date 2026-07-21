'use strict';

/**
 * ArchitectureAnalysisEngine — AI-tier architecture analysis.
 *
 * Reads the structural ArchitecturePattern[] already detected by ArchitectureDetectorEngine
 * and the dependency graph to produce a richer ArchitectureAIAnalysis object used as:
 *   1. model.ai.architecture (stored on the workspace)
 *   2. Context fed to the architecture LLM prompt builder
 *
 * This is a heuristic engine — no LLM call. It measures, classifies, and surfaces
 * structural facts about the architecture that a prompt builder can turn into
 * evidence for LLM reasoning.
 */
class ArchitectureAnalysisEngine {

  /**
   * Analyze a KnowledgeModel's architecture relationships.
   *
   * @param {object} model - Full KnowledgeModel passed through adaptModelForEngines
   * @returns {import('../../../../src/app/knowledge/models/architecture-ai-analysis.model').ArchitectureAIAnalysis}
   */
  analyze(model) {
    const patterns   = model.relationships?.architecture?.patterns ?? [];
    const graph      = model.relationships?.dependencies?.graph    ?? null;
    const hubs       = model.relationships?.dependencies?.hubs     ?? [];
    const folderTree = model.structure?.folderTree                 ?? null;
    const now        = new Date().toISOString();

    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);
    const dominant = sorted[0] ?? null;
    const competing = sorted.slice(1);

    const hubCount             = this._countHubs(hubs);
    const circularDependencies = this._findCircularDeps(graph);
    const couplingAssessment   = this._assessCoupling(hubCount, graph);
    const evolutionRisk        = this._assessEvolutionRisk(circularDependencies.length, hubCount, dominant);
    const boundaryViolations   = this._detectBoundaryViolations(graph, dominant);
    const layerBreakdown       = this._buildLayerBreakdown(folderTree, dominant, graph);

    return {
      dominantPattern:           dominant?.name           ?? 'Undetected',
      patternConfidence:         dominant?.confidence     ?? 0,
      competingPatterns:         competing.map(p => ({
        name:        p.name,
        confidence:  p.confidence,
        indicators:  p.indicators ?? [],
      })),
      layerBreakdown,
      hubCount,
      circularDependencyCount:   circularDependencies.length,
      couplingAssessment,
      evolutionRisk,
      boundaryViolations,
      generatedAt: now,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _countHubs(hubs) {
    return hubs.filter(h => h.isHub).length;
  }

  /**
   * Simple cycle detection using DFS on the dependency graph edges.
   * Returns the names of nodes that participate in at least one cycle.
   */
  _findCircularDeps(graph) {
    if (!graph?.nodes?.length || !graph?.edges?.length) return [];

    const adj = new Map();
    for (const node of graph.nodes) adj.set(node.id, []);
    for (const edge of graph.edges) {
      const list = adj.get(edge.sourceId);
      if (list) list.push(edge.targetId);
    }

    const visited  = new Set();
    const inStack  = new Set();
    const cycleNodes = new Set();

    const dfs = (nodeId) => {
      if (inStack.has(nodeId)) { cycleNodes.add(nodeId); return true; }
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const neighbor of (adj.get(nodeId) ?? [])) {
        if (dfs(neighbor)) cycleNodes.add(nodeId);
      }
      inStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) dfs(node.id);

    // Map cycle node IDs back to human-readable names
    const nodeNameMap = new Map(graph.nodes.map(n => [n.id, n.name ?? n.id]));
    return [...cycleNodes].map(id => nodeNameMap.get(id) ?? id).slice(0, 10);
  }

  _assessCoupling(hubCount, graph) {
    const totalNodes = graph?.nodes?.length ?? 0;
    if (totalNodes === 0) return 'Low';
    const ratio = hubCount / totalNodes;
    if (ratio >= 0.20) return 'Critical';
    if (ratio >= 0.12) return 'High';
    if (ratio >= 0.06) return 'Moderate';
    return 'Low';
  }

  _assessEvolutionRisk(circularCount, hubCount, dominant) {
    const score =
      (circularCount >= 5 ? 2 : circularCount >= 2 ? 1 : 0) +
      (hubCount       >= 5 ? 2 : hubCount       >= 2 ? 1 : 0) +
      (dominant && dominant.confidence < 0.60 ? 1 : 0);

    if (score >= 4) return 'High';
    if (score >= 2) return 'Moderate';
    return 'Low';
  }

  /**
   * Detect likely boundary violations by looking for high-hub nodes whose names
   * suggest they span multiple architectural layers (e.g. a service that is also
   * a repository pattern node).
   */
  _detectBoundaryViolations(graph, dominant) {
    if (!graph?.nodes?.length || !dominant) return [];

    const violations = [];
    const layerHints = this._getLayerHintsForPattern(dominant.name);
    if (!layerHints.length) return [];

    // Nodes with very high inbound degree that match multiple layer hint patterns
    const inbound = new Map();
    for (const edge of (graph.edges ?? [])) {
      inbound.set(edge.targetId, (inbound.get(edge.targetId) ?? 0) + 1);
    }

    const sorted = [...inbound.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const nodeNameMap = new Map(graph.nodes.map(n => [n.id, n.name ?? n.id]));

    for (const [id] of sorted) {
      const name = (nodeNameMap.get(id) ?? '').toLowerCase();
      const matchedLayers = layerHints.filter(l => l.patterns.some(p => p.test(name)));
      if (matchedLayers.length > 1) {
        violations.push(`${nodeNameMap.get(id)} spans ${matchedLayers.map(l => l.layer).join(' + ')}`);
      }
      if (violations.length >= 5) break;
    }

    return violations;
  }

  _getLayerHintsForPattern(patternName) {
    const MAP = {
      'Layered Architecture': [
        { layer: 'controller',  patterns: [/controller/i, /api/i, /endpoint/i] },
        { layer: 'service',     patterns: [/service/i, /manager/i, /orchestrator/i] },
        { layer: 'repository',  patterns: [/repositor/i, /repo\./i, /dao/i, /store/i] },
        { layer: 'data',        patterns: [/entity/i, /model/i, /dto/i] },
      ],
      'Clean Architecture': [
        { layer: 'domain',          patterns: [/domain/i, /entity/i, /aggregate/i] },
        { layer: 'application',     patterns: [/application/i, /usecase/i, /command/i, /query/i] },
        { layer: 'infrastructure',  patterns: [/infrastructure/i, /repositor/i, /database/i] },
        { layer: 'api',             patterns: [/controller/i, /api/i, /endpoint/i] },
      ],
      'MVC': [
        { layer: 'model',       patterns: [/model/i, /entity/i] },
        { layer: 'view',        patterns: [/view/i, /template/i, /page/i] },
        { layer: 'controller',  patterns: [/controller/i, /handler/i] },
      ],
    };
    return MAP[patternName] ?? [];
  }

  /**
   * Build a breakdown of architectural layers by examining folder names
   * and counting files/nodes that belong to each layer.
   */
  _buildLayerBreakdown(folderTree, dominant, graph) {
    if (!dominant || !folderTree) return [];

    const layerHints = this._getLayerHintsForPattern(dominant.name);
    if (!layerHints.length) {
      // Generic breakdown: top-level folders
      return this._genericFolderBreakdown(folderTree);
    }

    const nodeNames = graph?.nodes?.map(n => (n.name ?? '').toLowerCase()) ?? [];
    const breakdown = [];

    for (const hint of layerHints) {
      const fileCount = nodeNames.filter(n => hint.patterns.some(p => p.test(n))).length;
      if (fileCount === 0) continue;
      breakdown.push({
        name:         this._titleCase(hint.layer),
        fileCount,
        responsibility: this._layerResponsibility(hint.layer),
        couplingNotes:  fileCount > 10
          ? `${fileCount} nodes detected — check for layer bloat`
          : '',
      });
    }

    return breakdown.length ? breakdown : this._genericFolderBreakdown(folderTree);
  }

  _genericFolderBreakdown(folderTree) {
    if (!folderTree?.children?.length) return [];
    return folderTree.children.slice(0, 6).map(child => ({
      name:           child.name,
      fileCount:      child.fileCount ?? 0,
      responsibility: '',
      couplingNotes:  '',
    }));
  }

  _layerResponsibility(layer) {
    const MAP = {
      controller:     'Handles incoming requests and routes them to services',
      service:        'Encapsulates business logic and orchestrates operations',
      repository:     'Abstracts data access and persistence operations',
      data:           'Defines data structures, entities, and DTOs',
      domain:         'Core business rules and domain entities',
      application:    'Coordinates domain objects to fulfil use cases',
      infrastructure: 'External integrations, databases, and framework concerns',
      api:            'Public-facing entry points and request contracts',
      model:          'Data structures representing domain state',
      view:           'Presentation layer — renders UI or response output',
    };
    return MAP[layer.toLowerCase()] ?? '';
  }

  _titleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = { ArchitectureAnalysisEngine };
