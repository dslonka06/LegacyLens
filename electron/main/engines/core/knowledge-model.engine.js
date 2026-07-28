'use strict';

const { readGitMetadata } = require('../../services/git/git-reader.service');

/**
 * KnowledgeModelEngine — D4
 *
 * Converts a PipelineResult (D2/D3) into a KnowledgeModel with the domain-layer
 * structure: identity, capabilities, metadata, structure, relationships, insights.
 *
 * The model describes what the application KNOWS, not how it learned it.
 * Each layer builds on the previous:
 *   structure     → what objectively exists
 *   relationships → how those things connect
 *   insights      → what we can deterministically conclude
 */
class KnowledgeModelEngine {

  /**
   * @param {object} pipelineResult  Output of CapabilityPipelineEngine.run()
   * @param {object} [options]
   * @param {string} [options.repositoryPath]  Enables git metadata read for repository targets
   * @param {string} [options.workspaceName]
   * @returns {KnowledgeModel}
   */
  build(pipelineResult, options = {}) {
    const { targetType, executedCapabilities, capabilityErrors } = pipelineResult;
    const isFile       = targetType === 'file';
    const isMultiFile  = targetType === 'folder' || targetType === 'repository';
    const isRepository = targetType === 'repository';

    // ── Structure ──────────────────────────────────────────────────────────────
    const structure = {
      totalFiles:   pipelineResult.parsedFiles?.length ?? 0,
      languages:    pipelineResult.languages    ?? [],
      frameworks:   pipelineResult.frameworks   ?? [],
      technologies: pipelineResult.detectedTechnologies ?? [],
      symbols:      pipelineResult.symbolIndex  ?? {},
    };

    if (isMultiFile) {
      structure.folderTree = pipelineResult.folderStructure ?? null;
      structure.projects   = pipelineResult.projects        ?? [];
    }

    // File-scope extras — source code kept in model (file is small)
    if (isFile && pipelineResult.parsedFiles?.[0]) {
      const pf = pipelineResult.parsedFiles[0];
      structure.sourceCode  = pf.content    ?? null;
      structure.filePath    = pf.path       ?? null;
      structure.fileLanguage = pf.language  ?? (pipelineResult.languages?.[0] ?? null);
    }

    // ── Relationships ──────────────────────────────────────────────────────────
    const relationships = {};

    if (isMultiFile && pipelineResult.dependencyGraph) {
      relationships.dependencies = {
        graph: pipelineResult.dependencyGraph,
        hubs:  pipelineResult.dependencyHubs  ?? [],
        ranks: pipelineResult.dependencyRanks ?? [],
      };
    }

    if (isMultiFile && pipelineResult.architectureHints?.length) {
      relationships.architecture = {
        patterns: pipelineResult.architectureHints.map(hint =>
          typeof hint === 'string'
            ? { name: hint, confidence: null, indicators: [] }
            : hint,
        ),
      };
    }

    if (isRepository) {
      relationships.git = this.buildGitAnalysis(pipelineResult, options.repositoryPath);
    }

    // ── Insights ───────────────────────────────────────────────────────────────
    // Deterministic conclusions from code analysis.
    // For file targets the PatternParser produces structured analysis results.
    const insights = {};

    if (isFile && pipelineResult.parsedFiles?.[0]) {
      const pf = pipelineResult.parsedFiles[0];
      const ar = pf._analysisResult ?? {};  // raw PatternParser output (_analysisResult is the field name PatternParser uses)

      if (ar.complexity)      insights.complexity      = ar.complexity;
      if (ar.maintainability) insights.maintainability = ar.maintainability;

      if (ar.risks?.length) {
        insights.risks = ar.risks.map(r => ({
          severity:    r.severity    ?? 'low',
          description: r.description ?? String(r),
          location:    r.location    ?? undefined,
        }));
      }

      // Structured data flow — steps + inputs + outputs
      const rawDataFlow = ar.dataFlow;
      if (rawDataFlow) {
        const steps = typeof rawDataFlow === 'string'
          ? rawDataFlow.split(/→|->/).map(s => s.trim()).filter(Boolean)
          : (rawDataFlow.steps ?? []);
        insights.dataFlow = {
          steps,
          inputs:  ar.inputs  ?? [],
          outputs: ar.outputs ?? [],
        };
      }

      if (ar.hotspots?.length) insights.hotspots = ar.hotspots;
      if (ar.responsibilities?.length) insights.responsibilities = ar.responsibilities;
    }

    // ── Metadata ───────────────────────────────────────────────────────────────
    const metadata = {
      builtAt:       new Date().toISOString(),
      schemaVersion: '2',
    };

    return {
      // Identity
      targetType,
      workspaceName: options.workspaceName ?? null,

      // Capabilities — gates UI sections
      capabilities:     executedCapabilities,
      capabilityErrors: capabilityErrors ?? {},

      // Layers
      metadata,
      structure,
      relationships,
      insights,

      // AI — populated asynchronously by AIAnalysisService after this returns
      // ai: undefined
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  buildGitAnalysis(pipelineResult, repositoryPath) {
    if (pipelineResult.gitAnalysis && !pipelineResult.gitAnalysis.available) {
      if (!repositoryPath) return pipelineResult.gitAnalysis;
    }

    if (!repositoryPath) {
      return { available: false, branch: null, originUrl: null };
    }

    try {
      const meta = readGitMetadata(repositoryPath);
      return {
        available: true,
        branch:    meta.gitBranch  ?? null,
        originUrl: meta.gitUrl     ?? null,
      };
    } catch {
      return { available: false, branch: null, originUrl: null };
    }
  }
}

module.exports = { KnowledgeModelEngine };
