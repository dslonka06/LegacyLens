'use strict';

const { AnalysisService } = require('../analysis/analysis.service');

/**
 * KnowledgeModelService
 *
 * Persists and retrieves KnowledgeModel objects via the existing analyses table.
 * The KnowledgeModel is stored in the pattern_result JSON column so it coexists
 * with AI results (stored in ai_result) without requiring a schema change.
 */
class KnowledgeModelService {

  constructor() {
    this.analysisService = new AnalysisService();
  }

  /**
   * Persist a KnowledgeModel for a repository.
   * Returns the saved analysis record id.
   *
   * @param {string} repositoryId
   * @param {object} knowledgeModel  Output of KnowledgeModelEngine.build()
   * @returns {string}  The analysis record id
   */
  save(repositoryId, knowledgeModel) {
    if (!repositoryId) throw new Error('repositoryId is required');
    if (!knowledgeModel) throw new Error('knowledgeModel is required');

    const record = this.analysisService.save({
      repositoryId,
      scope: knowledgeModel.targetType ?? 'repository',
      patternResult: knowledgeModel,
      status: 'complete',
      version: '4.0',
    });

    return record.id;
  }

  /**
   * Retrieve the most recent KnowledgeModel for a repository.
   * Returns null if none exists or if the stored record has no pattern_result.
   *
   * @param {string} repositoryId
   * @returns {object|null}
   */
  getLatest(repositoryId) {
    const record = this.analysisService.getLatest(repositoryId);
    return record?.patternResult ?? null;
  }

  /**
   * Check whether a KnowledgeModel built from the given capabilities already
   * exists for this repository. Used by D6 incremental update logic to decide
   * whether a full rebuild is needed.
   *
   * @param {string} repositoryId
   * @param {string[]} requiredCapabilities
   * @returns {boolean}
   */
  isCurrent(repositoryId, requiredCapabilities) {
    const model = this.getLatest(repositoryId);
    if (!model?.capabilities) return false;
    return requiredCapabilities.every(cap => model.capabilities.includes(cap));
  }
}

module.exports = { KnowledgeModelService };
