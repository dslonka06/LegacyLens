const path = require('path');
const { app } = require('electron');

let db = null;

/**
 * Returns the path to the SQLite database file.
 * Stored in the OS user data directory so it survives app updates.
 */
function getDbPath() {
  return path.join(app.getPath('userData'), 'legacylens.db');
}

/**
 * Opens (or creates) the SQLite database and runs schema migrations.
 * Must be called once in app.whenReady() before any service uses the db.
 *
 * @returns {import('better-sqlite3').Database}
 */
function openDatabase() {
  if (db) return db;

  const Database = require('better-sqlite3');
  db = new Database(getDbPath());

  // WAL mode: faster writes, safe concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
}

/**
 * Returns the open database instance.
 * Throws if openDatabase() has not been called yet.
 */
function getDatabase() {
  if (!db) throw new Error('Database not initialised — call openDatabase() first');
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
  const currentVersion = row?.v ?? 0;

  const migrations = [
    migrate_v1,
    migrate_v2,
  ];

  for (let i = currentVersion; i < migrations.length; i++) {
    const run = db.transaction(() => {
      migrations[i](db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1);
    });
    run();
  }
}

function migrate_v1(db) {
  db.exec(`
    -- ── Repositories ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS repositories (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      path         TEXT NOT NULL UNIQUE,
      language     TEXT,
      framework    TEXT,
      git_url      TEXT,
      git_branch   TEXT,
      added_at     TEXT NOT NULL,
      last_opened  TEXT
    );

    -- ── Analyses ─────────────────────────────────────────────────────────────
    -- One row per analysis run. ai_result and pattern_result stored as JSON blobs.
    CREATE TABLE IF NOT EXISTS analyses (
      id              TEXT PRIMARY KEY,
      repository_id   TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      scope           TEXT NOT NULL,   -- 'file' | 'folder' | 'repository'
      file_name       TEXT,
      created_at      TEXT NOT NULL,
      ai_result       TEXT,            -- JSON
      pattern_result  TEXT             -- JSON
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses(repository_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);

    -- ── File Metadata ─────────────────────────────────────────────────────────
    -- One row per file per repository. Used for incremental analysis (hash compare).
    CREATE TABLE IF NOT EXISTS files (
      id             TEXT PRIMARY KEY,
      repository_id  TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      relative_path  TEXT NOT NULL,
      extension      TEXT,
      size           INTEGER,
      hash           TEXT,
      modified_at    TEXT,
      UNIQUE(repository_id, relative_path)
    );

    CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repository_id);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(repository_id, hash);

    -- ── Settings ──────────────────────────────────────────────────────────────
    -- Simple key/value store. Values stored as JSON so any type is supported.
    CREATE TABLE IF NOT EXISTS settings (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL   -- JSON-encoded value
    );
  `);
}

function migrate_v2(db) {
  // Add version tracking and status to analyses; add AI provider/model metadata fields.
  db.exec(`
    ALTER TABLE analyses ADD COLUMN version     TEXT;
    ALTER TABLE analyses ADD COLUMN status      TEXT DEFAULT 'complete';
    ALTER TABLE analyses ADD COLUMN ai_provider TEXT;
    ALTER TABLE analyses ADD COLUMN ai_model    TEXT;
  `);
}

module.exports = { openDatabase, getDatabase, getDbPath };
