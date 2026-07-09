# Phase 6 — Platform Operability
## Formal Specification

---

## Objective

Make the platform reliable across sessions and manageable at runtime. Phase 6 does not introduce new analytical capabilities — it hardens what Phases 1–5 built by ensuring workspaces survive restarts, the repository library stays consistent with the filesystem, analyses can be re-run or cancelled, and results can be exported in portable formats.

Phase 6 is entirely additive. No existing analytical, AI, or rendering logic is changed. Every deliverable operates at the infrastructure and service layer, with minimal UI surface that will be refined in a later pass.

---

## Architectural Principles

**Session Continuity**
A workspace that existed before an app restart must be present after it. The KnowledgeModel — the product of potentially minutes of analysis — must not be discarded on close. Restoration is transparent: no re-upload, no re-analysis required if the model was already built.

**Defensive Library Management**
The repository library reflects the filesystem, not just what was added. Paths that no longer exist are flagged rather than silently breaking on open. Metadata can be refreshed in place without removing and re-adding a repository.

**Interruptible Analysis**
Every analysis pipeline can be stopped. Stopping discards in-flight AI results without corrupting the workspace. Re-triggering analysis replays the last-known inputs without requiring the user to re-upload files.

**Pluggable Export**
Exporting is a routing concern, not a page concern. Pages do not call exporters directly. `ExportService` owns format routing; adding a new format touches only that one service.

---

## Responsibility Split

### Electron (Phase 6 scope)
- Persisting workspace state to SQLite on every change
- Restoring persisted workspaces on startup
- Deleting workspace rows when workspaces are removed

### Angular (Phase 6 scope)
- Restoring workspaces from Electron storage into `WorkspaceManagerService` on init
- Validating repository paths against the filesystem before opening
- Exposing re-analyze and cancel actions via the workspace panel
- Reporting active AI stages as live progress chips
- Routing export requests through `ExportService` to format-specific exporters

### Unchanged from Phase 5
- KnowledgeModel construction and AI pipeline orchestration
- All seven intelligence capability pages
- IPC contracts for analysis, files, repositories, and settings

---

## Deliverables

---

### D3 — Workspace Persistence

#### Description

Workspaces are persisted to SQLite and restored on application startup. The KnowledgeModel — if present — is serialised as a JSON blob alongside workspace metadata. On restart, workspaces rehydrate into `WorkspaceManagerService` exactly as if the user had never closed the app.

Raw `File[]` objects are intentionally excluded from persistence; they are browser-memory constructs and cannot be serialised. A restored workspace whose model is present gets `status: 'ready'`. A restored workspace without a model gets `status: 'empty'`, indicating re-upload is required to rebuild.

#### Implementation

- **`migrate_v3`** — adds `workspaces` table to SQLite. No foreign key on `repository_id` so file and folder workspaces persist without a corresponding repository row.
- **`workspace.ipc.js`** — replaces the Phase 2 stub. Registers `workspaces:getAll`, `workspaces:save` (upsert by id), and `workspaces:delete`.
- **`electron/main.js`** — registers workspace handlers alongside all other IPC modules.
- **`electron/preload/preload.js`** — exposes `electronAPI.workspaces` namespace.
- **`src/electron.d.ts`** — adds `PersistedWorkspace`, `ElectronWorkspacesAPI`, wires into `ElectronAPI`.
- **`ElectronService`** — adds `getPersistedWorkspaces()`, `saveWorkspace()`, `deleteWorkspace()`.
- **`WorkspaceManagerService`** — calls `restoreFromStorage()` in the constructor. Debounces saves 300ms per workspace after every `patch()` call to avoid a SQLite write on each AI stage merge. Calls `deleteWorkspace()` on `delete()`.

#### Schema

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  status           TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  last_modified_at TEXT NOT NULL,
  repository_id    TEXT,
  knowledge_model  TEXT   -- JSON blob; null until structural phase completes
);
```

#### Acceptance Criteria
- Workspaces present before app close are present after restart
- The most recently modified workspace is active on startup
- Workspaces with a persisted KnowledgeModel are immediately usable (`status: 'ready'`) without re-upload
- Deleting a workspace removes its SQLite row
- Persistence is a no-op in browser (non-Electron) mode — `isElectron` guard throughout

---

### D2 — Repository Library Management

#### Description

Repository cards in the home page reflect the current state of the filesystem. Paths that no longer exist are detected and flagged. Repository metadata can be refreshed (re-reads git branch/URL from disk) and renamed in place without removing and re-adding.

#### Implementation

- **`home-page.ts`** — adds `repoPathStatus: Map<string, 'ok' | 'missing' | 'checking'>`. On load, calls `detectTarget` for all repositories concurrently and populates the map. `openRepository` exits early if the path is `'missing'`. `completeAddRepository` re-checks paths after adding.
- **`startRename` / `commitRename` / `cancelRename`** — inline rename using an `<input>` that replaces the name text; saves via `RepositoryLibraryService.update()`.
- **`refreshRepo`** — calls `touch()` (which re-reads git metadata on the main process) then reloads the list and re-validates the path.
- **HTML** — missing badge (`lib-badge-missing`) inline with the repo name; rename input swaps in when editing; refresh and rename action buttons visible on card hover.
- **SCSS** — `lib-card-missing` (dimmed, no-navigate hover), `lib-badge-missing` (red pill), `lib-card-name-input` (accent-bordered input), `lib-card-action-btn` (hover-reveal icon buttons with spin animation for refresh).

#### Dedup
Already handled server-side: `RepositoryLibraryService.add()` returns the existing row if the path matches. No client-side dedup needed.

#### Acceptance Criteria
- Cards for paths that no longer exist show a "Path missing" badge and cannot be opened
- Clicking Rename allows editing the repository name inline; Enter commits, Escape cancels
- Clicking Refresh re-reads git metadata from disk and re-validates the path
- Deduplication is enforced at add time — the same path cannot appear twice

---

### D4 — Analysis Management

#### Description

Running analyses can be cancelled. Completed analyses can be re-run using the files from the last upload without requiring the user to re-select them. Active AI stages are reported as live progress chips in the workspace panel.

#### Implementation

**Generation counter (cancellation token)**

`WorkspaceManagerService` tracks a generation counter per workspace via `nextGeneration(id)` and `getGeneration(id)`. The counter is incremented at the start of every pipeline run (including re-analyze) and whenever `cancelAnalysis` is called. `mergeAIResults` and `markAIStageFailed` accept an optional `generation` argument and silently discard the result if the current generation has moved on.

**Stage progress**

`WorkspaceManagerService` exposes `activeStages$: Observable<Map<string, Set<AIStage>>>`. `AIAnalysisService.runStage()` calls `setStageRunning(id, stage)` before the IPC call and `clearStageRunning(id, stage)` in `finally`. `WorkspacePanel` subscribes to `combineLatest([activeWorkspace$, activeStages$])` and renders a pulsing chip per running stage.

**Input cache**

`WorkspaceKnowledgeService` maintains `_inputCache: Map<string, WorkspaceInputCache>` keyed by workspace ID. `process()` populates the cache before delegating to the pipeline. `reanalyze(id)` reads from the cache, increments the generation, clears the model, and re-runs the full pipeline. Returns `null` if no cache entry exists for the workspace.

**Workspace panel actions**

- **Re-analyze** — shown when `canReanalyze` (cache entry exists and not currently processing). Calls `knowledge.reanalyze(id)`.
- **Cancel** — shown when `isAnalyzing` (status is processing or stages are running). Calls `knowledge.cancelAnalysis(id)`, which increments the generation and clears all stage markers. The structural Electron IPC call cannot be interrupted; if it completes after cancellation the result is dropped by the generation check.

#### Acceptance Criteria
- Clicking Cancel during analysis discards all in-flight AI results without corrupting the workspace
- Clicking Re-analyze clears the existing model and re-runs the full pipeline from cached inputs
- Active AI stage names appear as pulsing chips in the workspace panel while running
- Re-analyze is not available if no files have been processed in the current session (cache miss)
- AI results arriving after Cancel or Re-analyze are silently dropped

---

### D8 — Export & Sharing

#### Description

The active workspace's KnowledgeModel can be exported as a portable JSON file or as a PDF documentation report. Export actions are available from the workspace panel whenever the model is ready. Adding a new export format in the future requires only a new exporter and a case in `ExportService` — no pages change.

#### Implementation

**`ExportService`**

Routes `export(format: 'pdf' | 'json', model: KnowledgeModel)` to the appropriate exporter. Isolated from pages — pages never instantiate exporters directly.

| Format | Exporter | Mechanism |
|--------|----------|-----------|
| `json` | Inline in `ExportService` | `Blob` + `URL.createObjectURL` → browser download |
| `pdf`  | `PdfExportService` | Delegates to `exportFromModel(model, defaultSelections(model))` |

JSON filename: `{workspaceName}-knowledge.json` with non-alphanumeric characters replaced by underscores.

**`WorkspacePanel`**

Injects `ExportService`. Renders a bordered export row below the action buttons when `canExport` (`status === 'ready'` and `knowledgeModel !== null`). Contains "JSON" and "PDF" buttons; both disable during an in-progress export (`isExporting` flag).

**Extensibility contract**

To add a new export format:
1. Add the format literal to `ExportType` in `export.service.ts`
2. Add a `case` to `ExportService.export()`
3. Implement the exporter service

No page, panel, or IPC change is required.

#### Acceptance Criteria
- "JSON" button downloads a `{name}-knowledge.json` file containing the full serialised KnowledgeModel
- "PDF" button generates a PDF documentation report using all available sections
- Export buttons are only visible when the workspace has a ready KnowledgeModel
- Both buttons are disabled while an export is in progress
- Adding a new export format does not require modifying any page or panel component

---

## Deferred Deliverables

The following were explicitly scoped out of Phase 6:

| Deliverable | Reason |
|-------------|--------|
| D1 — Monitoring & Observability | Not a user-facing need at this stage; deferred indefinitely |
| D5 — Settings & Configuration | Low priority relative to completed deliverables |
| D6 — Git Integration UI | Infrastructure already exists (`relationships.git` in KnowledgeModel); UI surface deferred to a future pass on existing intelligence pages |
| D7 — Plugin Architecture | Requires stable public API contracts; premature at this stage |

---

## Definition of Done

Phase 6 is complete when:

1. Workspaces restore automatically on startup with their KnowledgeModel intact, requiring no re-upload for ready workspaces
2. Repository cards reflect filesystem reality — missing paths are flagged and blocked from opening
3. Every running analysis can be cancelled, and cancelled analyses leave the workspace in a clean state
4. Re-analyze replays the last uploaded files without re-upload; active stages are reported live in the workspace panel
5. KnowledgeModel JSON and PDF documentation export are available from the workspace panel whenever a model is ready
6. `ExportService` is the sole routing point for export — no page imports an exporter directly

---

Generated by Rocket Flow · 2.0.20 · 2026-07-09
