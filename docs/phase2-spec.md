# Phase 2 — SQLite Data Platform
## Formal Specification

---

## Objective

Replace all in-memory and localStorage state with a SQLite database owned by the Electron main process. All persistent data — repositories, analyses, file metadata, and settings — lives in SQLite and is accessed by Angular exclusively via IPC.

Phase 2 makes the application stateful across restarts. A repository analyzed in one session is available the next time the application opens. Analysis results are cached and restored without re-running the full pipeline when the underlying files have not changed. Angular has no direct storage dependencies for analysis data after this phase is complete.

---

## Architectural Principles

**Electron Owns Persistence**
SQLite is managed entirely within the Electron main process. Angular never reads from or writes to the database directly. All storage operations occur through IPC.

**Migration-Based Schema Evolution**
The database schema is versioned and evolves through an explicit migration system. New schema versions are additive. No migration destroys existing data.

**Synchronous SQLite**
`better-sqlite3` provides synchronous access within the Electron main process. This eliminates async complexity in the storage layer and keeps IPC handler implementations straightforward.

**Incremental by Default**
File hashing is built into the storage layer from the start. Every stored file entry carries a hash. Change detection compares current hashes against stored values and returns only the files that have actually changed.

**Safe Fallback**
Cache restoration is non-fatal. If the cache is absent, stale, or corrupt, the application falls through to a full analysis pipeline without surfacing an error to the user.

**Angular as Thin Client**
Angular presents data and initiates operations. It does not manage analysis state, maintain session context across restarts, or perform any storage logic.

---

## Responsibility Split

### Angular
- Rendering UI
- Navigation and routing
- User interaction
- Requesting storage operations via IPC
- Displaying data returned via IPC

### Electron
- SQLite ownership and migration
- All CRUD operations against the database
- File hashing and change detection
- Git metadata refresh on repository open
- IPC handler registration for all storage channels

### SQLite
- Repository metadata
- Analysis results and AI outputs
- File metadata and hashes
- Application settings

---

## Schema

The database is created at `app.getPath('userData')/legacylens.db`. All schema changes are applied through the migration system on startup.

### v1 — Baseline Schema

```sql
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT,
  framework TEXT,
  git_url TEXT,
  git_branch TEXT,
  added_at TEXT NOT NULL,
  last_opened TEXT
);

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  file_name TEXT,
  created_at TEXT NOT NULL,
  ai_result TEXT,
  pattern_result TEXT
);

CREATE TABLE file_metadata (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  extension TEXT,
  size INTEGER,
  hash TEXT,
  modified_at TEXT,
  UNIQUE(repository_id, relative_path)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### v2 — AI Metadata Columns

```sql
ALTER TABLE analyses ADD COLUMN version TEXT;
ALTER TABLE analyses ADD COLUMN status TEXT DEFAULT 'complete';
ALTER TABLE analyses ADD COLUMN ai_provider TEXT;
ALTER TABLE analyses ADD COLUMN ai_model TEXT;
```

---

## Deliverables

---

### D1 — SQLite Schema and Migration System

#### Description

Establish the database module at `electron/main/database/database.js`. On startup, the module opens the database file at the userData path and runs all pending migrations in sequence. Migrations are idempotent — re-running them against an already-migrated database is safe.

`migrate_v1()` creates the four baseline tables. `migrate_v2()` adds the AI metadata columns to the analyses table. All future schema changes follow the same pattern: a new numbered migration function that applies additive changes only.

#### Acceptance Criteria
- The database file is created at `app.getPath('userData')/legacylens.db` on first launch
- `migrate_v1()` creates all four baseline tables
- `migrate_v2()` adds `version`, `status`, `ai_provider`, and `ai_model` columns to the analyses table
- Migrations run on every startup and are safe to execute against an already-migrated database
- A migration that has already been applied does not alter data or fail
- The database module is imported by the Electron main process before IPC handlers are registered

---

### D2 — Repository Service

#### Description

`electron/main/services/repository-library.service.js` provides full CRUD access to the repositories table.

`getAll()` returns all stored repositories ordered by `last_opened` descending. `add(repo)` inserts a new repository record. `update(id, changes)` applies partial updates to an existing record. `touch(id)` updates `last_opened` to the current timestamp and refreshes `git_branch` and `git_url` by re-reading the repository's Git metadata from disk. `remove(id)` deletes a repository record.

`touch` is called every time the user opens a repository from the library. It ensures the displayed metadata reflects the current state of the repository on disk without requiring a full re-analysis.

#### Acceptance Criteria
- `getAll()` returns all repositories ordered by last opened, most recent first
- `add(repo)` inserts a repository with all provided fields
- `update(id, changes)` applies partial field updates without affecting unmodified columns
- `touch(id)` updates `last_opened` to the current timestamp and refreshes Git metadata from disk
- `remove(id)` deletes the repository record
- All methods operate synchronously using `better-sqlite3`
- Service methods do not throw on missing records; they return null or no-op as appropriate

---

### D3 — Analysis Service

#### Description

`electron/main/services/analysis.service.js` handles saving and retrieving analysis results.

`save(analysis)` persists an analysis record, storing `ai_result` and `pattern_result` as JSON strings. It accepts the v2 fields — `version`, `status`, `ai_provider`, `ai_model` — and writes them when present. `getLatest(repositoryId)` returns the most recent analysis for a repository. `getHistory(repositoryId)` returns all analyses for a repository ordered by `created_at` descending. `delete(id)` removes an analysis record.

An internal `toAnalysis()` mapper converts the database's snake_case column names to the camelCase fields consumed by Angular.

#### Acceptance Criteria
- `save(analysis)` persists `ai_result` and `pattern_result` as serialized JSON strings
- `save(analysis)` writes `version`, `status`, `ai_provider`, and `ai_model` when present
- `getLatest(repositoryId)` returns the single most recent analysis for the given repository
- `getHistory(repositoryId)` returns all analyses ordered by creation date, newest first
- `delete(id)` removes the specified analysis record
- `toAnalysis()` maps all snake_case columns to camelCase before returning results to callers
- JSON deserialization failures on stored results do not crash the service

---

### D4 — File Metadata Service

#### Description

`electron/main/services/file-metadata.service.js` stores per-file metadata and drives incremental change detection.

`sync(repositoryId, files)` upserts file records for all entries in the provided files array. Each entry carries `relativePath`, `extension`, `size`, `hash`, and `modifiedAt`. Records are inserted on first sync and updated on subsequent syncs. `getAll(repositoryId)` returns all stored file records for a repository. `getChanged(repositoryId, currentFiles)` compares the hashes of the current file list against stored values and returns the relative paths of files whose hash has changed or that are not yet present in the database.

#### Acceptance Criteria
- `sync(repositoryId, files)` upserts records using the `UNIQUE(repository_id, relative_path)` constraint
- `sync` stores `extension`, `size`, `hash`, and `modified_at` for each file entry
- `getAll(repositoryId)` returns all file records for the given repository
- `getChanged(repositoryId, currentFiles)` returns relative paths for files with changed or absent hashes
- Files present in the database but absent from `currentFiles` are not returned by `getChanged`
- All methods operate synchronously

---

### D5 — Settings Service

#### Description

`electron/main/services/settings.service.js` provides a JSON-serialized key-value store backed by the settings table.

`get(key)` retrieves a value by key, deserializing JSON automatically. `set(key, value)` serializes the value to JSON and upserts the record. `getAll()` returns all settings as a plain object keyed by column name. `delete(key)` removes a settings entry.

Settings are used internally to store `aiProvider` and `aiModel` selections. These values are read by `AnalysisPersistenceService` before saving an analysis record.

#### Acceptance Criteria
- `get(key)` returns the deserialized value for the given key, or null if absent
- `set(key, value)` serializes the value to JSON and upserts the settings record
- `getAll()` returns all settings deserialized into a plain object
- `delete(key)` removes the settings record for the given key
- JSON serialization round-trips primitive values, arrays, and objects correctly
- A missing key does not throw; `get` returns null

---

### D6 — Workspace Restore and Analysis Persistence

#### Description

Angular saves analysis results automatically and restores them on subsequent opens when files have not changed.

`AnalysisPersistenceService` (`src/app/analysis/services/analysis-persistence.service.ts`) is a root singleton bootstrapped via `APP_INITIALIZER`. It watches `WorkspaceManagerService.activeWorkspace$` and saves to SQLite via `electronService.saveAnalysis()` once the workspace carries both a Knowledge Model and an AI explanation. It reads `aiProvider` and `aiModel` from settings before constructing the save payload.

The repository analysis page implements `tryRestoreFromCache(repositoryId, workspaceId, entries)`. On page init, it calls `getLatestAnalysis` followed by `getChangedFiles`. If no changed files are detected, it replays all AI fields from the cached analysis into the workspace manager and returns true. If any files have changed, or if no cache exists, or if any step throws, the method returns false and the page falls through to the full analysis pipeline.

FNV-1a 32-bit hashing (`src/app/core/utils/hash.ts`) is used throughout the file change detection pipeline.

`PendingRepositoryService` (`src/app/core/services/pending-repository.service.ts`) is an ephemeral bridge service. The home page sets `{ path, repositoryId }` on this service before navigating to the repository analysis page. The analysis page reads and clears the pending value on init. This avoids passing navigation state through route parameters or query strings.

#### Acceptance Criteria
- `AnalysisPersistenceService` is provided at root and initialized via `APP_INITIALIZER`
- Analysis is saved to SQLite automatically when `activeWorkspace$` emits a workspace with knowledge and AI explanation present
- `aiProvider` and `aiModel` are read from settings and included in the save payload
- `tryRestoreFromCache` returns true and restores all AI fields when no file changes are detected
- `tryRestoreFromCache` returns false when no cached analysis exists, when files have changed, or when any step throws
- A false return from `tryRestoreFromCache` triggers the full analysis pipeline without displaying an error
- FNV-1a hashes are used for all file change detection comparisons
- `PendingRepositoryService` stores `{ path, repositoryId }` and is cleared on read

---

### D7 — Repository Library UI

#### Description

The home page presents saved repositories as cards. Each card displays the repository name, last opened timestamp, detected language, and current Git branch.

**Add Repository** opens a folder picker dialog. On confirmation, `electronService.addRepository()` is called with the selected path. The application navigates to the repository analysis page.

**Open** calls `electronService.touchRepository()` to refresh metadata and update `last_opened`, then navigates to the repository analysis page.

**Remove** calls `electronService.removeRepository()` and removes the card from the list.

On app load, if the most recently opened repository was last opened fewer than 24 hours ago, the application auto-navigates to that repository's analysis page without user interaction.

#### Acceptance Criteria
- Saved repository cards display name, last opened timestamp, language, and Git branch
- Add Repository opens the OS folder picker and calls `electronService.addRepository()` on confirmation
- Open calls `electronService.touchRepository()` before navigating
- Remove calls `electronService.removeRepository()` and removes the card immediately
- Auto-restore navigates to the last opened repository on app load if it was opened within the past 24 hours
- An empty library state is handled gracefully with a prompt to add the first repository
- Navigation after Add and Open lands on the correct repository analysis page

---

### D8 — Analysis History UI

#### Description

The repository analysis page loads the analysis history for the open repository on init via `electronService.getAnalysisHistory()`. History entries are displayed in a list with relative timestamps.

`formatHistoryDate(iso)` converts an ISO timestamp to a human-readable relative label: `Today`, `Yesterday`, or `X days ago`.

`restoreAnalysis(analysis)` replays a selected history entry's AI results back into the workspace manager, making them available to all downstream pages without re-running analysis.

#### Acceptance Criteria
- Analysis history is loaded on repository analysis page init
- History entries are displayed with relative timestamps using `formatHistoryDate`
- `formatHistoryDate` produces `Today`, `Yesterday`, or `X days ago` for all inputs
- `restoreAnalysis` replays saved AI results into the workspace manager
- Restoring from history does not trigger a new analysis run
- An empty history state is handled gracefully

---

### D9 — Scan Progress UI

#### Description

The repository analysis page surfaces scan progress to the user during filesystem traversal. `loadFromPath()` registers a progress listener via `electronService.onScanProgress()`. As the scan proceeds, `scanFileCount` is updated on the component and rendered in the UI. `isScanning` is set to true at scan start and false when the scan completes.

The progress listener is unregistered and `isScanning` is reset after scan completion. `ngOnDestroy` cleans up `scanProgressUnsub` to prevent listener leaks when the component is destroyed mid-scan.

#### Acceptance Criteria
- `scanFileCount` updates progressively as files are discovered during the scan
- `isScanning` is true during an active scan and false otherwise
- The progress listener is unregistered after scan completion
- `ngOnDestroy` calls `scanProgressUnsub` to clean up the listener if the component is destroyed before the scan completes
- Progress UI does not render during cache restoration (no scan is performed in that path)

---

## Definition of Done

Phase 2 is complete when:

1. The SQLite database is created at the userData path on first launch and the migration system has applied all schema versions
2. All four service modules — repository, analysis, file metadata, and settings — are implemented and accessible via IPC
3. Analysis results saved in one session are restored in the next session when files have not changed
4. The repository library persists across application restarts and displays accurate metadata for all saved repositories
5. The analysis history UI displays past analyses with relative timestamps and supports one-click restore
6. Angular has no localStorage dependencies for analysis data or repository state
7. File change detection using FNV-1a hashes correctly identifies modified files and bypasses cache restoration when changes are present
8. All error paths in cache restoration fall through silently to the full analysis pipeline

---

Generated by Rocket Flow · 2.0.20 · 2026-07-08
