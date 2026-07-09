'use strict';

const { FileMetadataService } = require('../../services/files/file-metadata.service');
const { KnowledgeModelService } = require('../../services/knowledge/knowledge-model.service');

/**
 * IncrementalUpdateEngine — D6
 *
 * Decides whether a full rebuild is needed or whether the existing
 * KnowledgeModel is still current. Extends the Phase 2 hash-based change
 * detection pipeline — it does not replace it.
 *
 * Decision logic:
 *   1. No stored model → full rebuild required
 *   2. Stored model missing required capabilities → full rebuild required
 *   3. Changed files detected via hash comparison → partial rebuild (changed paths returned)
 *   4. No changes → model is current, no rebuild needed
 */
class IncrementalUpdateEngine {

  constructor() {
    this.fileMetadata     = new FileMetadataService();
    this.knowledgeModels  = new KnowledgeModelService();
  }

  /**
   * Check whether the stored KnowledgeModel is current for a repository.
   *
   * @param {string} repositoryId
   * @param {Array<{relativePath: string, hash: string}>} currentFiles  Current file hashes
   * @param {string[]} requiredCapabilities  Capabilities the model must have been built with
   * @returns {IncrementalCheckResult}
   */
  check(repositoryId, currentFiles, requiredCapabilities = []) {
    // Step 1: does a model exist?
    const existing = this.knowledgeModels.getLatest(repositoryId);
    if (!existing) {
      return this.fullRebuild('No stored KnowledgeModel found');
    }

    // Step 2: does the model cover all required capabilities?
    if (requiredCapabilities.length > 0) {
      const missing = requiredCapabilities.filter(
        cap => !existing.capabilities?.includes(cap)
      );
      if (missing.length > 0) {
        return this.fullRebuild(`Missing capabilities: ${missing.join(', ')}`);
      }
    }

    // Step 3: which files changed since the model was built?
    const changedPaths = this.fileMetadata.getChangedPaths(repositoryId, currentFiles);

    if (changedPaths.length === 0) {
      return {
        needsFullRebuild: false,
        needsPartialRebuild: false,
        changedPaths: [],
        reason: 'Model is current — no file changes detected',
        existingModel: existing,
      };
    }

    // Changed files found — partial rebuild covers only affected files.
    // A partial rebuild is promoted to full when >30% of files changed,
    // since re-running the full pipeline is cheaper than selective patching
    // at that scale.
    const changeRatio = changedPaths.length / Math.max(currentFiles.length, 1);
    if (changeRatio > 0.3) {
      return this.fullRebuild(
        `${changedPaths.length} of ${currentFiles.length} files changed (${Math.round(changeRatio * 100)}%) — full rebuild is more efficient`,
      );
    }

    return {
      needsFullRebuild: false,
      needsPartialRebuild: true,
      changedPaths,
      reason: `${changedPaths.length} file(s) changed since last build`,
      existingModel: existing,
    };
  }

  /**
   * Apply a partial rebuild: re-run file parsing and symbol extraction only
   * for the changed files, then merge the results back into the existing model.
   *
   * This preserves unchanged knowledge (dependency graph, architecture, projects)
   * and updates only the portions that changed.
   *
   * @param {object} existingModel  The current KnowledgeModel
   * @param {string[]} changedPaths  Relative paths of changed files
   * @param {Array<{name,path,extension,content}>} changedFileContents  File descriptors for changed files
   * @param {Function} parserFn  PatternParser.parse — injected to avoid circular dependency
   * @returns {object}  Updated KnowledgeModel
   */
  applyPartialRebuild(existingModel, changedPaths, changedFileContents, parserFn) {
    const changedPathSet = new Set(changedPaths);

    // Re-parse changed files
    const newParsed = changedFileContents.map(f => parserFn(f));

    // Merge: replace entries for changed paths, keep everything else
    const updatedParsedFiles = [
      ...(existingModel.parsedFiles ?? []).filter(pf => !changedPathSet.has(pf.path)),
      ...newParsed,
    ];

    // Update symbol index
    const updatedSymbolIndex = { ...(existingModel.symbolIndex ?? {}) };
    for (const pf of newParsed) {
      updatedSymbolIndex[pf.path] = {
        classes:  pf.classes,
        methods:  pf.methods,
        imports:  pf.imports,
        exports:  pf.exports,
        language: pf.language,
        type:     pf.type,
      };
      // Remove stale entries for deleted files
      for (const p of changedPaths) {
        if (!changedFileContents.some(f => f.path === p)) {
          delete updatedSymbolIndex[p];
        }
      }
    }

    // Rebuild sourceFiles from updated parsedFiles
    const updatedSourceFiles = updatedParsedFiles.map(pf => ({
      path: pf.path,
      extension: pf.extension ?? '',
      content: '',
    }));

    // Recompute language counts
    const counts = {};
    for (const pf of updatedParsedFiles) {
      if (pf.language && pf.language !== 'Unknown') {
        counts[pf.language] = (counts[pf.language] ?? 0) + 1;
      }
    }
    const updatedLanguages = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    return {
      ...existingModel,
      parsedFiles:   updatedParsedFiles,
      sourceFiles:   updatedSourceFiles,
      symbolIndex:   updatedSymbolIndex,
      languages:     updatedLanguages,
      builtAt:       new Date().toISOString(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  fullRebuild(reason) {
    return {
      needsFullRebuild:    true,
      needsPartialRebuild: false,
      changedPaths:        [],
      reason,
      existingModel:       null,
    };
  }
}

module.exports = { IncrementalUpdateEngine };
