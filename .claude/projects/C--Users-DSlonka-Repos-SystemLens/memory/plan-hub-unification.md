---
name: plan-hub-unification
description: Full plan to unify folder/repo hub pages to use the file hub single-page pattern — no /new routes, SQLite cache restore for all three, identical lifecycle
metadata:
  type: project
---

# Hub Unification Plan

Eliminate the two-page split (new-page → hub-page) for folder and repository analysis.
Make all three analysis types use the file hub single-component lifecycle pattern.
Add SQLite cache restore to file and folder (currently only repo has it).

**Why:** Every bug we have chased (workspace ID race, sidebar stuck on 'new', blank space
transitions) comes from navigating between /new and the hub page. File analysis has none of
these bugs because it never leaves the hub page.

---

## Completion Checklist

### Phase 1 — Routes
- [ ] 1.1 Remove `file-analysis/new` route from `app.routes.ts`
- [ ] 1.2 Remove `folder-analysis/new` route from `app.routes.ts`
- [ ] 1.3 Remove `repository-analysis/new` route from `app.routes.ts`

### Phase 2 — File hub: add SQLite cache restore
- [ ] 2.1 Add `WorkspaceClassifierService`, `CurrentWorkspaceService`, `TargetValidationService` imports to `file-analysis-page.ts`
- [ ] 2.2 Add `hashContent` import and `EXT_TO_LANGUAGE` constant to `file-analysis-page.ts`
- [ ] 2.3 Add `isScanning`, `scanFileCount`, `validationResult`, `pendingValidationPath`, `scanProgressUnsub` fields
- [ ] 2.4 Add `ValidationDialog` to component imports array
- [ ] 2.5 Rename `processFiles` → keep but add `filePath` persistence via `manager.setPath`
- [ ] 2.6 Add `tryRestoreFromCache(repositoryId, workspaceId, entries)` method (identical pattern to repo hub)
- [ ] 2.7 Add hot/cold reanalyze path for file — already exists, just confirm `persist: true` when Electron
- [ ] 2.8 Add `onValidationProceed` / `onValidationCancel` handlers
- [ ] 2.9 Add `<app-validation-dialog>` to `file-analysis-page.html`

### Phase 3 — Folder hub: absorb new-page, add SQLite cache restore
- [ ] 3.1 Add `ElectronService`, `WorkspaceClassifierService`, `CurrentWorkspaceService`, `TargetValidationService` imports to `folder-analysis-page.ts`
- [ ] 3.2 Add `hashContent` import, `EXT_TO_LANGUAGE` constant
- [ ] 3.3 Add `isScanning`, `scanFileCount`, `validationResult`, `pendingValidationPath`, `scanProgressUnsub` fields
- [ ] 3.4 Add `ValidationDialog` to component imports array
- [ ] 3.5 Move `browseFolder()` to open Electron folder picker IPC (not `<input webkitdirectory>`) — folder uses browser FileReader for file content, but path-based picker is better UX. Keep `<input>` fallback for non-Electron.
  - **Decision:** Keep existing browser `<input webkitdirectory>` drag+drop AND add Electron `electron.pickFolder()` path — same as repo hub `pickAndLoadFolder()`. Use Electron path if available, browser input otherwise.
- [ ] 3.6 Add `loadFromPath(folderPath)` — validates, scans with progress, classifies, tryRestoreFromCache, else knowledge.process
- [ ] 3.7 Add `tryRestoreFromCache(repositoryId, workspaceId, entries)` — same pattern as repo
- [ ] 3.8 Add `buildFileMetadata(files)` helper
- [ ] 3.9 Add `onValidationProceed` / `onValidationCancel`
- [ ] 3.10 Wire `ngOnInit` auto-load: `if (ws.status === 'empty' && ws.path) this.loadFromPath(ws.path)`
- [ ] 3.11 Update `folder-analysis-page.html` — add validation dialog, add Electron picker button alongside existing drag-drop zone, add scanning progress state inside identity card
- [ ] 3.12 Update `reanalyze()` — add cold path: if no cache, re-read from `ws.path` via `electron.readDirectory`

### Phase 4 — Repo hub: remove new-page dependencies, align with pattern
- [ ] 4.1 Move `EXT_TO_LANGUAGE` from inline method to module-level constant (already done in new-page, fix in hub page)
- [ ] 4.2 Confirm `ngOnInit` auto-load path (`ws.status === 'empty' && ws.path`) already exists — it does (line 203)
- [ ] 4.3 Move `onValidationProceed` redirect targets from `/folder-analysis/new` → `/folder-analysis` and `/file-analysis/new` → `/file-analysis` — already done in hub page, confirm

### Phase 5 — Delete new-pages
- [ ] 5.1 Delete `src/app/features/file-analysis/pages/file-analysis-new-page/` directory (4 files: .ts, .html, .scss, spec if any)
- [ ] 5.2 Delete `src/app/features/folder-analysis/pages/folder-analysis-new-page/` directory
- [ ] 5.3 Delete `src/app/features/repository-analysis/pages/repository-analysis-new-page/` directory

### Phase 6 — Verify
- [ ] 6.1 `npx tsc --noEmit --project tsconfig.app.json` — zero errors
- [ ] 6.2 Confirm no dead imports or references to deleted files remain in codebase

---

## Key Design Decisions

### File hub does NOT use Electron IPC for reading
`processFiles()` uses browser `FileReader` in-memory. For cache restore we need
`electron.readFile(path)` on cold reanalyze. The file hub already does this.
For SQLite cache restore on file: since files have no `repositoryId` equivalent,
we'd need to use `ws.path` as the key. Check if `getLatestAnalysis` / `getChangedFiles`
work with file paths. If not, skip file SQLite cache restore — file analysis is fast enough
that caching has less value than for large repos.

**Revised decision on file cache restore:** File analysis is in-memory only (`persist: false`).
The Electron SQLite cache is keyed by `repositoryId` which is set by the Electron engine for
repository targets only. File analysis doesn't set `repositoryId`. Adding SQLite cache restore
for file would require the engine to generate a file-specific ID — out of scope.
**File cache restore: SKIP.** File reanalyze cold-path (re-read from `ws.path`) is sufficient.

### Folder SQLite cache restore
Folder analysis currently uses `persist: false` (no SQLite write). The repo path uses
`persist: true` which tells the Electron engine to write to SQLite.
For folder cache restore to work, folder analysis must also use `persist: true` and the engine
must return a `repositoryId` for folder targets.
**Check:** Does the engine return `metadata.buildId` / set `repositoryId` for `targetType: 'folder'`?
If yes → add `persist: true` and the full cache restore path.
If no → add `persist: true` to enable future caching but skip the `tryRestoreFromCache` check
for now (it will just return false if no saved analysis exists).

### `browseFolder` for folder hub (non-Electron)
In non-Electron (browser dev mode), `electron.isElectron` is false. `pickFolder()` won't work.
Keep the existing `<input webkitdirectory>` drag-drop path for non-Electron.
Add an Electron picker path alongside it, like the repo hub's `pickAndLoadFolder`.
The hub identity card shows both options or auto-selects based on context.

### `sameAsBootstrap` guard
Both folder and repo hub have this guard in `activeWorkspace$`. File hub does NOT — it calls
`runAnimations()` unconditionally on every subscription emission. When absorbing new-page logic
into the hubs, keep the existing `sameAsBootstrap` guard in folder and repo — it's needed to
prevent double-animation when navigating back to an existing analysis.

---

## File Inventory

### Files modified
- `src/app/core/app.routes.ts` — remove 3 /new routes
- `src/app/features/file-analysis/pages/file-analysis-page/file-analysis-page.ts` — add persist path, cold reanalyze already exists
- `src/app/features/file-analysis/pages/file-analysis-page/file-analysis-page.html` — add validation dialog
- `src/app/features/folder-analysis/pages/folder-analysis-page/folder-analysis-page.ts` — add Electron picker, scanning, cache restore, buildFileMetadata
- `src/app/features/folder-analysis/pages/folder-analysis-page/folder-analysis-page.html` — add scanning state, Electron picker button, validation dialog
- `src/app/features/repository-analysis/pages/repository-analysis-page/repository-analysis-page.ts` — fix EXT_TO_LANGUAGE location, confirm onValidationProceed targets

### Files deleted
- `src/app/features/file-analysis/pages/file-analysis-new-page/file-analysis-new-page.ts`
- `src/app/features/file-analysis/pages/file-analysis-new-page/file-analysis-new-page.html`
- `src/app/features/file-analysis/pages/file-analysis-new-page/file-analysis-new-page.scss`
- `src/app/features/folder-analysis/pages/folder-analysis-new-page/folder-analysis-new-page.ts`
- `src/app/features/folder-analysis/pages/folder-analysis-new-page/folder-analysis-new-page.html`
- `src/app/features/folder-analysis/pages/folder-analysis-new-page/folder-analysis-new-page.scss`
- `src/app/features/repository-analysis/pages/repository-analysis-new-page/repository-analysis-new-page.ts`
- `src/app/features/repository-analysis/pages/repository-analysis-new-page/repository-analysis-new-page.html`
- `src/app/features/repository-analysis/pages/repository-analysis-new-page/repository-analysis-new-page.scss`

---

**Why:** [[heuristic-narrative-architecture]], [[project-hub-ui-design]]
