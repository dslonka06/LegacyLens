'use strict';

const { readGitMetadata } = require('../../services/git/git-reader.service');

/**
 * KnowledgeModelEngine
 *
 * Converts a PipelineResult (D2/D3) into a structured KnowledgeModel.
 * The model adapts to the validated target type — file models contain only
 * file-relevant data; folder/repository models add progressively more.
 *
 * Backward-compatible: sourceFiles, dependencyGraph, and architecture fields
 * are present in all target types that support them, preserving the shape
 * existing analysis consumers expect from RepositoryKnowledge.
 */
class KnowledgeModelEngine {

  /**
   * Build a KnowledgeModel from a PipelineResult.
   *
   * @param {object} pipelineResult  Output of CapabilityPipelineEngine.run()
   * @param {object} [options]
   * @param {string} [options.repositoryPath]  Absolute path — enables git metadata read for repository targets
   * @param {string} [options.workspaceName]
   * @returns {KnowledgeModel}
   */
  build(pipelineResult, options = {}) {
    const { targetType, executedCapabilities, capabilityErrors } = pipelineResult;

    const model = {
      // ── Identity ────────────────────────────────────────────────────────
      targetType,
      builtAt: new Date().toISOString(),
      workspaceName: options.workspaceName ?? null,
      capabilities: executedCapabilities,
      capabilityErrors,

      // ── Code Processing (D3) ────────────────────────────────────────────
      // parsedFiles carries the PatternParser output for every source file.
      // Consumers that previously read sourceFiles can use parsedFiles instead —
      // each entry has path, extension, language, classes, methods, imports, exports.
      parsedFiles: pipelineResult.parsedFiles ?? [],

      // ── Language & Technology ────────────────────────────────────────────
      languages: pipelineResult.languages ?? [],
      detectedTechnologies: pipelineResult.detectedTechnologies ?? [],
      frameworks: pipelineResult.frameworks ?? [],

      // ── Symbol Index ─────────────────────────────────────────────────────
      // Path-keyed map: { [path]: { classes, methods, imports, exports, language, type } }
      symbolIndex: pipelineResult.symbolIndex ?? {},

      // ── Backward-compatible sourceFiles ──────────────────────────────────
      // Reconstructed from parsedFiles so existing consumers (SystemUnderstanding,
      // Security, Recommendations) continue working without changes.
      sourceFiles: this.toSourceFiles(pipelineResult.parsedFiles ?? []),
    };

    // ── Folder & above ───────────────────────────────────────────────────────
    if (targetType === 'folder' || targetType === 'repository') {
      model.folderStructure  = pipelineResult.folderStructure ?? null;
      model.dependencyGraph  = pipelineResult.dependencyGraph ?? null;
      model.dependencyHubs   = pipelineResult.dependencyHubs ?? [];
      model.dependencyRanks  = pipelineResult.dependencyRanks ?? [];
      model.projects         = pipelineResult.projects ?? [];

      // Backward-compatible architecture field
      model.architecture = pipelineResult.architectureHints
        ? { patterns: pipelineResult.architectureHints.map(hint => ({ name: hint, confidence: null, indicators: [] })) }
        : null;
    }

    // ── Repository only ──────────────────────────────────────────────────────
    if (targetType === 'repository') {
      model.architectureHints = pipelineResult.architectureHints ?? null;

      // Git metadata — read from filesystem if repo path provided
      model.gitAnalysis = this.buildGitAnalysis(pipelineResult, options.repositoryPath);
    }

    return model;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  toSourceFiles(parsedFiles) {
    // PatternParser stores the raw content in _analysisResult — not retained.
    // Reconstruct the minimal SourceFile shape { path, extension, content: '' }
    // so downstream engines that iterate sourceFiles still get a valid array.
    // Content is intentionally empty here — D5 Context Generation will provide
    // content-aware context without storing full file content in the KnowledgeModel.
    return parsedFiles.map(pf => ({
      path: pf.path,
      extension: pf.extension ?? '',
      content: '',
    }));
  }

  buildGitAnalysis(pipelineResult, repositoryPath) {
    // If the pipeline already ran GIT_ANALYSIS and reported unavailable, honor it
    if (pipelineResult.gitAnalysis && !pipelineResult.gitAnalysis.available) {
      if (!repositoryPath) return pipelineResult.gitAnalysis;
    }

    if (!repositoryPath) {
      return { available: false, reason: 'No repository path provided' };
    }

    try {
      const meta = readGitMetadata(repositoryPath);
      return {
        available: true,
        branch: meta.gitBranch,
        originUrl: meta.gitUrl,
      };
    } catch {
      return { available: false, reason: 'Failed to read git metadata' };
    }
  }
}

module.exports = { KnowledgeModelEngine };
