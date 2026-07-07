const { randomUUID } = require('crypto');
const { getDatabase } = require('../../database/database');

class AnalysisService {

  /**
   * Saves a completed analysis to the database.
   * @param {{repositoryId: string, scope: string, fileName?: string, aiResult?: object, patternResult?: object}} data
   * @returns {{id, repositoryId, scope, fileName, createdAt, aiResult, patternResult}}
   */
  save(data) {
    if (!data?.repositoryId) throw new Error('repositoryId is required');
    if (!data?.scope) throw new Error('scope is required');

    const record = {
      id: randomUUID(),
      repository_id: data.repositoryId,
      scope: data.scope,
      file_name: data.fileName ?? null,
      created_at: new Date().toISOString(),
      ai_result: data.aiResult ? JSON.stringify(data.aiResult) : null,
      pattern_result: data.patternResult ? JSON.stringify(data.patternResult) : null,
    };

    getDatabase().prepare(`
      INSERT INTO analyses (id, repository_id, scope, file_name, created_at, ai_result, pattern_result)
      VALUES (@id, @repository_id, @scope, @file_name, @created_at, @ai_result, @pattern_result)
    `).run(record);

    return toAnalysis(record);
  }

  /**
   * Returns the most recent analysis for a repository.
   * @param {string} repositoryId
   * @returns {object|null}
   */
  getLatest(repositoryId) {
    const row = getDatabase()
      .prepare('SELECT * FROM analyses WHERE repository_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(repositoryId);
    return row ? toAnalysis(row) : null;
  }

  /**
   * Returns all analyses for a repository, newest first.
   * @param {string} repositoryId
   * @returns {object[]}
   */
  getHistory(repositoryId) {
    return getDatabase()
      .prepare('SELECT * FROM analyses WHERE repository_id = ? ORDER BY created_at DESC')
      .all(repositoryId)
      .map(toAnalysis);
  }

  /**
   * Deletes a specific analysis record.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const result = getDatabase().prepare('DELETE FROM analyses WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

function toAnalysis(row) {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    scope: row.scope,
    fileName: row.file_name ?? null,
    createdAt: row.created_at,
    aiResult: row.ai_result ? JSON.parse(row.ai_result) : null,
    patternResult: row.pattern_result ? JSON.parse(row.pattern_result) : null,
  };
}

module.exports = { AnalysisService };
