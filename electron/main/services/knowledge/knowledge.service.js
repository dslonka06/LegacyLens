'use strict';

const { CapabilityPipelineEngine, CAPABILITY_MAP } = require('../../engines/core/capability-pipeline.engine');
const { KnowledgeModelEngine } = require('../../engines/core/knowledge-model.engine');
const { KnowledgeModelService } = require('./knowledge-model.service');
const { IncrementalUpdateEngine } = require('../../engines/core/incremental-update.engine');
const { FileMetadataService } = require('../files/file-metadata.service');
const { PatternParser } = require('../../engines/core/pattern-parser');

/**
 * KnowledgeService — D7
 *
 * The single entry point for all workspace analysis. Orchestrates:
 *   D1  Target type is validated before this service is called (caller's responsibility)
 *   D2  Capability pipeline — run capabilities for the target type
 *   D3  PatternParser — code processing within the pipeline
 *   D4  KnowledgeModelEngine — build structured model from pipeline result
 *   D5  ContextGenerationEngine — called separately via intelligence:buildContext
 *   D6  IncrementalUpdateEngine — skip full rebuild when model is current
 *
 * Angular calls intelligence:processWorkspace and receives a KnowledgeModel.
 * No Angular service independently parses source files after this completes.
 */
class KnowledgeService {

  constructor() {
    this.pipeline         = new CapabilityPipelineEngine();
    this.modelEngine      = new KnowledgeModelEngine();
    this.modelService     = new KnowledgeModelService();
    this.incrementalEngine = new IncrementalUpdateEngine();
    this.fileMetadata     = new FileMetadataService();
    this.parser           = new PatternParser();
  }

  /**
   * Process a workspace: run the full D2–D4 pipeline and return a KnowledgeModel.
   *
   * @param {object} request
   * @param {'file'|'folder'|'repository'} request.targetType   Validated target from D1
   * @param {Array<{name,path,extension,content}>}  request.files  Source file descriptors
   * @param {object} [request.options]
   * @param {string} [request.options.repositoryId]    Required for persistence and incremental updates
   * @param {string} [request.options.repositoryPath]  Required for git metadata (repository targets)
   * @param {string} [request.options.workspaceName]
   * @param {boolean} [request.options.persist]        Persist model to SQLite (default: true when repositoryId provided)
   * @param {boolean} [request.options.incremental]    Enable incremental updates (default: true)
   * @returns {KnowledgeModel}
   */
  process(request) {
    const { targetType, files, options = {} } = request;
    const { repositoryId, repositoryPath, workspaceName } = options;
    const persist     = options.persist     !== false && !!repositoryId;
    const incremental = options.incremental !== false && !!repositoryId;

    // ── D6: Incremental check ────────────────────────────────────────────────
    if (incremental && repositoryId) {
      const currentHashes = files
        .filter(f => f.content !== null && f.content !== undefined)
        .map(f => ({ relativePath: f.path, hash: this.hashContent(f.content) }));

      const requiredCapabilities = CAPABILITY_MAP[targetType] ?? [];
      const check = this.incrementalEngine.check(repositoryId, currentHashes, requiredCapabilities);

      if (!check.needsFullRebuild && !check.needsPartialRebuild) {
        // Model is current — return cached model with metadata flag set
        const cached = { ...check.existingModel };
        cached.metadata = { ...cached.metadata, fromCache: true };
        return cached;
      }

      if (!check.needsFullRebuild && check.needsPartialRebuild) {
        // Partial rebuild — re-parse only changed files
        const changedFiles = files.filter(f => check.changedPaths.includes(f.path));
        const updatedModel = this.incrementalEngine.applyPartialRebuild(
          check.existingModel,
          check.changedPaths,
          changedFiles,
          f => this.parser.parse(f),
        );

        if (persist) {
          this.syncFileHashes(repositoryId, files);
          this.modelService.save(repositoryId, updatedModel);
        }

        const partial = { ...updatedModel };
        partial.metadata = { ...partial.metadata, fromCache: false, partialRebuild: true };
        return partial;
      }
    }

    // ── D2/D3: Full capability pipeline ─────────────────────────────────────
    const pipelineResult = this.pipeline.run(targetType, files);

    // ── D4: Build Knowledge Model ────────────────────────────────────────────
    const model = this.modelEngine.build(pipelineResult, { repositoryPath, workspaceName });

    // ── Persist ──────────────────────────────────────────────────────────────
    if (persist) {
      this.syncFileHashes(repositoryId, files);
      const buildId = this.modelService.save(repositoryId, model);
      model.metadata = { ...model.metadata, buildId };
    }

    const result = { ...model };
    result.metadata = { ...result.metadata, fromCache: false, partialRebuild: false };
    return result;
  }

  /**
   * Retrieve the most recently persisted KnowledgeModel for a repository.
   * Returns null if none exists.
   */
  getLatest(repositoryId) {
    return this.modelService.getLatest(repositoryId);
  }

  /**
   * Check incremental status without processing.
   * Returns the check result so Angular can show appropriate loading state.
   */
  checkIncremental(repositoryId, currentFiles, targetType) {
    const requiredCapabilities = CAPABILITY_MAP[targetType] ?? [];
    return this.incrementalEngine.check(repositoryId, currentFiles, requiredCapabilities);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  syncFileHashes(repositoryId, files) {
    try {
      const entries = files
        .filter(f => f.content !== null && f.content !== undefined)
        .map(f => ({
          relativePath: f.path,
          extension: f.extension ?? null,
          size: f.content?.length ?? 0,
          hash: this.hashContent(f.content),
          modifiedAt: null,
        }));
      this.fileMetadata.syncFiles(repositoryId, entries);
    } catch {
      // Non-fatal — hash sync failure does not block the model from being returned
    }
  }

  hashContent(content) {
    // FNV-1a 32-bit — fast, non-cryptographic, consistent with Phase 2 hash approach
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }
}

module.exports = { KnowledgeService };
