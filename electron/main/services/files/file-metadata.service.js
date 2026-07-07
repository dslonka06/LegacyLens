const { randomUUID } = require('crypto');
const { getDatabase } = require('../../database/database');

class FileMetadataService {

  /**
   * Upserts file metadata for a repository.
   * Returns counts of new, changed, and unchanged files.
   * @param {string} repositoryId
   * @param {Array<{relativePath: string, extension?: string, size?: number, hash?: string, modifiedAt?: string}>} files
   * @returns {{upserted: number, unchanged: number}}
   */
  syncFiles(repositoryId, files) {
    const db = getDatabase();

    const upsert = db.prepare(`
      INSERT INTO files (id, repository_id, relative_path, extension, size, hash, modified_at)
      VALUES (@id, @repository_id, @relative_path, @extension, @size, @hash, @modified_at)
      ON CONFLICT(repository_id, relative_path) DO UPDATE SET
        extension   = excluded.extension,
        size        = excluded.size,
        hash        = excluded.hash,
        modified_at = excluded.modified_at
    `);

    const syncAll = db.transaction((files) => {
      let upserted = 0;
      for (const f of files) {
        const existing = db.prepare(
          'SELECT hash FROM files WHERE repository_id = ? AND relative_path = ?'
        ).get(repositoryId, f.relativePath);

        const changed = !existing || existing.hash !== f.hash;
        upsert.run({
          id: existing ? undefined : randomUUID(),
          repository_id: repositoryId,
          relative_path: f.relativePath,
          extension: f.extension ?? null,
          size: f.size ?? null,
          hash: f.hash ?? null,
          modified_at: f.modifiedAt ?? null,
        });
        if (changed) upserted++;
      }
      return upserted;
    });

    const upserted = syncAll(files);
    return { upserted, unchanged: files.length - upserted };
  }

  /**
   * Returns all file metadata for a repository.
   * @param {string} repositoryId
   */
  getAll(repositoryId) {
    return getDatabase()
      .prepare('SELECT * FROM files WHERE repository_id = ?')
      .all(repositoryId)
      .map(toFile);
  }

  /**
   * Returns only the files whose hash differs from what's stored —
   * i.e. the files that changed since the last analysis.
   * @param {string} repositoryId
   * @param {Array<{relativePath: string, hash: string}>} currentFiles
   * @returns {string[]} relative paths of changed files
   */
  getChangedPaths(repositoryId, currentFiles) {
    const db = getDatabase();
    const stored = new Map(
      db.prepare('SELECT relative_path, hash FROM files WHERE repository_id = ?')
        .all(repositoryId)
        .map(r => [r.relative_path, r.hash])
    );

    return currentFiles
      .filter(f => stored.get(f.relativePath) !== f.hash)
      .map(f => f.relativePath);
  }

  /**
   * Removes all file metadata for a repository.
   * @param {string} repositoryId
   */
  clearRepository(repositoryId) {
    getDatabase()
      .prepare('DELETE FROM files WHERE repository_id = ?')
      .run(repositoryId);
  }
}

function toFile(row) {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    relativePath: row.relative_path,
    extension: row.extension ?? null,
    size: row.size ?? null,
    hash: row.hash ?? null,
    modifiedAt: row.modified_at ?? null,
  };
}

module.exports = { FileMetadataService };
