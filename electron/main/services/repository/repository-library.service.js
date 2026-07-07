const { randomUUID } = require('crypto');
const { getDatabase } = require('../../database/database');

class RepositoryLibraryService {

  /**
   * Returns all repositories ordered by most recently opened.
   * @returns {Array<{id, name, path, language, framework, gitUrl, gitBranch, addedAt, lastOpened}>}
   */
  getAll() {
    return getDatabase()
      .prepare('SELECT * FROM repositories ORDER BY last_opened DESC, added_at DESC')
      .all()
      .map(toRepository);
  }

  /**
   * Adds a repository. If the path already exists, returns the existing record.
   * @param {{name: string, path: string, language?: string, framework?: string, gitUrl?: string, gitBranch?: string}} request
   */
  add(request) {
    if (!request?.name || typeof request.name !== 'string') {
      throw new Error('Repository name is required');
    }
    if (!request?.path || typeof request.path !== 'string') {
      throw new Error('Repository path is required');
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM repositories WHERE path = ?').get(request.path.trim());
    if (existing) return toRepository(existing);

    const repo = {
      id: randomUUID(),
      name: request.name.trim(),
      path: request.path.trim(),
      language: request.language ?? null,
      framework: request.framework ?? null,
      git_url: request.gitUrl ?? null,
      git_branch: request.gitBranch ?? null,
      added_at: new Date().toISOString(),
      last_opened: null,
    };

    db.prepare(`
      INSERT INTO repositories (id, name, path, language, framework, git_url, git_branch, added_at, last_opened)
      VALUES (@id, @name, @path, @language, @framework, @git_url, @git_branch, @added_at, @last_opened)
    `).run(repo);

    return toRepository(repo);
  }

  /**
   * Updates the last_opened timestamp for a repository.
   * @param {string} id
   */
  touch(id) {
    getDatabase()
      .prepare('UPDATE repositories SET last_opened = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  /**
   * Updates metadata fields on an existing repository.
   * @param {string} id
   * @param {{name?: string, language?: string, framework?: string, gitUrl?: string, gitBranch?: string}} updates
   */
  update(id, updates) {
    const db = getDatabase();
    const current = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
    if (!current) throw new Error(`Repository ${id} not found`);

    db.prepare(`
      UPDATE repositories
      SET name = ?, language = ?, framework = ?, git_url = ?, git_branch = ?
      WHERE id = ?
    `).run(
      updates.name ?? current.name,
      updates.language ?? current.language,
      updates.framework ?? current.framework,
      updates.gitUrl ?? current.git_url,
      updates.gitBranch ?? current.git_branch,
      id,
    );

    return toRepository(db.prepare('SELECT * FROM repositories WHERE id = ?').get(id));
  }

  /**
   * Removes a repository and all its associated analyses and file metadata.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const result = getDatabase()
      .prepare('DELETE FROM repositories WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}

function toRepository(row) {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    language: row.language ?? null,
    framework: row.framework ?? null,
    gitUrl: row.git_url ?? null,
    gitBranch: row.git_branch ?? null,
    addedAt: row.added_at,
    lastOpened: row.last_opened ?? null,
  };
}

module.exports = { RepositoryLibraryService };
