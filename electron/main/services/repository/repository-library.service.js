const { randomUUID } = require('crypto');

/**
 * In-memory repository library.
 * Phase 1: stores known repositories in memory (lost on app restart).
 * Phase 2: this class will persist to SQLite — the public API stays the same.
 */
class RepositoryLibraryService {
  /** @type {Array<{id: string, name: string, path: string, addedAt: string, lastOpenedAt: string|null}>} */
  #repositories = [];

  /**
   * Returns all known repositories.
   * @returns {Array<{id: string, name: string, path: string, addedAt: string, lastOpenedAt: string|null}>}
   */
  getAll() {
    return [...this.#repositories];
  }

  /**
   * Adds a repository to the library.
   * @param {{name: string, path: string}} request
   * @returns {{id: string, name: string, path: string, addedAt: string, lastOpenedAt: string|null}}
   */
  add(request) {
    if (!request?.name || typeof request.name !== 'string') {
      throw new Error('Repository name is required');
    }
    if (!request?.path || typeof request.path !== 'string') {
      throw new Error('Repository path is required');
    }

    const existing = this.#repositories.find(r => r.path === request.path);
    if (existing) {
      return existing;
    }

    const repo = {
      id: randomUUID(),
      name: request.name.trim(),
      path: request.path.trim(),
      addedAt: new Date().toISOString(),
      lastOpenedAt: null,
    };

    this.#repositories.push(repo);
    return repo;
  }

  /**
   * Removes a repository by ID.
   * @param {string} id
   * @returns {boolean} true if removed, false if not found
   */
  remove(id) {
    const index = this.#repositories.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.#repositories.splice(index, 1);
    return true;
  }
}

module.exports = { RepositoryLibraryService };
