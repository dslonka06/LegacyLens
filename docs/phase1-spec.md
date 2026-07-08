# Phase 1 — Electron Platform Architecture
## Formal Specification

---

## Objective

Establish Electron as the platform layer for LegacyLens. Angular transitions from a full-stack application into a UI-only presentation layer. All platform concerns — filesystem access, database interaction, AI communication, and code analysis — move to the Electron main process.

Phase 1 creates the architectural foundation that every subsequent phase builds on. It introduces the IPC contract between Angular and Electron, the security model governing that communication, and the initial set of backend engines and services. Angular has no direct access to the filesystem or any platform API after this phase is complete.

---

## Architectural Principles

**Angular as Presentation Only**
Angular is responsible for rendering, navigation, and user interaction. It requests all platform operations through IPC and never directly accesses the filesystem, spawns processes, or communicates with external services.

**Electron as Platform Owner**
The Electron main process is the sole owner of filesystem access, AI communication, repository metadata, and all future platform capabilities. This ownership is enforced structurally — context isolation and disabled node integration ensure Angular cannot bypass the IPC layer.

**Standardized IPC Envelope**
All communication between Angular and Electron follows a single envelope shape: `{ success: boolean, data?: any, error?: string }`. The `wrapHandler()` utility enforces this on every handler. Angular's `invoke()` unwraps the response and throws on failure, keeping error handling consistent across all callers.

**Security by Default**
`contextIsolation: true` and `nodeIntegration: false` are non-negotiable. The `contextBridge` is the only surface through which Angular and Electron communicate. These constraints cannot be weakened in any subsequent phase.

**Worker Isolation for Long-Running Work**
Filesystem scanning runs in a dedicated `worker_threads` worker. The main process remains responsive during directory traversal. Cancellation is supported at the IPC level.

---

## Responsibility Split

### Angular
- Rendering UI
- Navigation and routing
- User interaction
- Displaying data returned via IPC
- Requesting platform operations through IPC

### Electron (Main Process)
- Filesystem access and directory scanning
- Repository metadata management
- Git metadata extraction
- AI provider communication (HTTP transport)
- IPC handler registration and request routing
- Worker thread lifecycle management
- Database layer (established in Phase 1; data persistence deferred to Phase 2)

### window.electronAPI (contextBridge)
- The only permitted communication surface between Angular and Electron
- Exposes named namespaces: `repositories`, `analysis`, `files`, `filesystem`, `settings`, `ai`
- All methods return Promises; all errors propagate through the standard IPC envelope

---

## IPC Contract

Every IPC handler is registered with `ipcMain.handle` and wrapped with `wrapHandler()`, which catches unhandled errors and formats them into the standard envelope. Angular calls through `window.electronAPI`, which calls `ipcRenderer.invoke` and unwraps the result.

```
Angular UI
  ↓  window.electronAPI.<namespace>.<method>()
contextBridge (preload\preload.js)
  ↓  ipcRenderer.invoke(channel, ...args)
ipcMain.handle (electron\main.js)
  ↓  wrapHandler(() => ...)
IPC Handler (electron\main\ipc\*.ipc.js)
  ↓
Service / Engine / Worker
```

**IPC Namespaces:**

| Namespace | Operations |
|---|---|
| `repositories` | getAll, add, update, touch, remove |
| `analysis` | save, getLatest, getHistory, delete |
| `files` | sync, getAll, getChanged, clearRepository |
| `filesystem` | openDialog, readDirectory, cancelScan, readFile, exportPdf, onScanProgress |
| `settings` | get, set, getAll, delete |
| `ai` | explain, analyze, getProviderUrl, setProviderUrl |

---

## File Structure

```
electron\
  main.js                           — app entry, BrowserWindow, registers all IPC handlers
  preload\
    preload.js                      — contextBridge, exposes window.electronAPI
  main\
    ipc\
      repository.ipc.js             — repositories:getAll/add/update/touch/remove
      analysis.ipc.js               — analysis:save/getLatest/getHistory/delete
      filesystem.ipc.js             — filesystem:openDialog/readDirectory/cancelScan/readFile/exportPdf
      files.ipc.js                  — files:sync/getAll/getChanged/clearRepository
      settings.ipc.js               — settings:get/set/getAll/delete
      ai.ipc.js                     — ai:explain/analyze/getProviderUrl/setProviderUrl
      ipc-utils.js                  — wrapHandler() utility
    services\
      git\
        git-reader.service.js       — reads .git/HEAD and .git/config for branch + origin URL
    engines\
      ai\
        knowledge.engine.js         — AiKnowledgeEngine, Node.js HTTP transport for explain
        analysis.engine.js          — AiAnalysisEngine, Node.js HTTP transport for analyze
      (18 intelligence engines present; Phase 4 migration targets)
    workers\
      filesystem.worker.js          — worker_threads worker for directory scanning
    database\
      database.js                   — schema + migrations (written; activation deferred to Phase 2)
  shared\
    contracts\
      ipc-channels.ts               — all IPC channel name constants

src\app\
  core\services\
    electron.service.ts             — Angular-side thin wrapper over window.electronAPI
  electron.d.ts                     — TypeScript interfaces for all IPC types
```

---

## Deliverables

---

### D1 — Electron Shell

#### Description

Establish the Electron application shell: a `BrowserWindow` configured with the correct security settings, the application lifecycle (open, close, activate), and the `contextBridge` surface in the preload script. This deliverable defines the boundary between Angular and Electron at the structural level.

The `BrowserWindow` loads the Angular application and enforces `contextIsolation: true` and `nodeIntegration: false` unconditionally. The preload script is the sole mechanism through which Angular accesses any Electron capability.

#### Acceptance Criteria
- The Angular application loads inside a `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`
- Application lifecycle events (window-all-closed, activate, ready) are handled correctly on all platforms
- The preload script runs in the isolated context and exposes `window.electronAPI` via `contextBridge`
- Angular cannot access Node.js APIs or Electron internals directly
- The shell builds and launches without errors

---

### D2 — IPC Envelope

#### Description

Establish the communication contract that governs all Angular↔Electron interaction. Every IPC handler is wrapped with `wrapHandler()`, which catches unhandled errors and returns the standard envelope. Angular's `invoke()` unwraps the response and throws on failure, so callers never need to inspect the envelope shape directly.

This deliverable does not introduce any domain handlers — it establishes the infrastructure that all subsequent IPC deliverables depend on.

#### Acceptance Criteria
- `wrapHandler()` in `electron\main\ipc\ipc-utils.js` wraps all `ipcMain.handle` registrations
- Every successful response is shaped as `{ success: true, data: <result> }`
- Every error response is shaped as `{ success: false, error: <message> }`
- `invoke()` in the preload script unwraps the response and throws if `success` is false
- Angular callers receive either the unwrapped data or a thrown error — they never inspect the envelope directly
- The pattern is applied consistently; no handler bypasses it

---

### D3 — Repository IPC

#### Description

Expose repository management operations through the `repositories` namespace. Repository records hold the metadata that associates a workspace with a filesystem path — name, path, language, framework, and Git metadata populated by the Git reader service.

All five operations are live end-to-end: Angular calls through `window.electronAPI.repositories`, the IPC layer routes to `repository.ipc.js`, and the handlers operate against in-memory storage until Phase 2 introduces SQLite persistence.

#### Acceptance Criteria
- `repositories:getAll`, `add`, `update`, `touch`, and `remove` are registered and reachable from Angular
- `add` and `touch` call `git-reader.service.js` and attach `gitBranch` and `gitUrl` to the repository record
- All operations return the standard IPC envelope
- Angular's `ElectronService` exposes corresponding typed methods
- TypeScript contracts in `electron.d.ts` cover all repository request and response shapes

---

### D4 — Git Metadata

#### Description

Read branch name and remote origin URL from a repository's `.git/` directory without shelling out to Git. The reader is a pure Node.js implementation that parses the relevant files directly.

`readGitMetadata(repoPath)` returns `{ gitBranch, gitUrl }`. It reads `.git/HEAD` to extract the branch name from the `ref: refs/heads/<name>` format, and reads `.git/config` to find the `url =` line under `[remote "origin"]`. Any read or parse failure returns `null` for the affected fields — the operation is always non-throwing.

#### Acceptance Criteria
- `git-reader.service.js` in `electron\main\services\git\` implements `readGitMetadata(repoPath)`
- Branch name is parsed from `.git/HEAD` without executing `git` commands
- Remote origin URL is parsed from `.git/config` without executing `git` commands
- The function returns `null` for either field if the corresponding data cannot be read or parsed
- The function is non-throwing under all error conditions
- Called on `repositories:add` and `repositories:touch`; results are attached to the repository record

---

### D5 — Worker Thread Filesystem Scanner

#### Description

Implement directory scanning as a `worker_threads` worker. The scanner traverses a given root path, applies source extension filtering, reads UTF-8 content for supported text files, and emits progress events during the scan. Long-running scans do not block the main process.

The worker is self-contained — it does not require anything from the parent process. All constants it needs are defined locally within the worker file. Communication follows a typed message protocol:

| Message type | Payload |
|---|---|
| `progress` | `{ type: 'progress', count, path }` — emitted every 50 files |
| `file` | `{ type: 'file', file: ElectronDirectoryEntry }` — emitted per qualifying file |
| `done` | `{ type: 'done', total }` — emitted on completion |

File entries use a two-tier content model: source files within the size limit receive UTF-8 `content`; binaries and oversized files receive `content: null` with size and timestamp metadata only. All entries include `modifiedAt: stat.mtime.toISOString()`.

`filesystem:cancelScan` terminates the worker immediately via `worker.terminate()`.

#### Acceptance Criteria
- Directory scanning runs in a `worker_threads` worker without blocking the main process
- The worker is self-contained and does not require modules from the parent process
- Progress events are posted every 50 files with the current count and path
- File events carry a complete `ElectronDirectoryEntry` per qualifying file
- A `done` event is posted on completion with the total file count
- Source files within the size threshold receive UTF-8 content; all other files receive `content: null`
- All file entries include `modifiedAt` as an ISO 8601 string
- `filesystem:cancelScan` terminates the active worker
- The `filesystem:onScanProgress` listener in the preload script forwards progress events to Angular

---

### D6 — AI IPC

#### Description

Expose AI provider communication through the `ai` namespace. Two engines handle the two interaction types: `AiKnowledgeEngine` (explain) and `AiAnalysisEngine` (analyze). Both use Node.js HTTP transport. Provider URL is configurable at runtime through `ai:getProviderUrl` and `ai:setProviderUrl` — this allows the AI provider to be changed without rebuilding the application.

#### Acceptance Criteria
- `ai:explain`, `ai:analyze`, `ai:getProviderUrl`, and `ai:setProviderUrl` are registered and reachable from Angular
- `AiKnowledgeEngine` handles explain requests; `AiAnalysisEngine` handles analyze requests
- Both engines use Node.js HTTP transport — no browser fetch is used for AI communication
- Provider URL is persisted through the settings layer and readable on application start
- All operations return the standard IPC envelope
- Angular's `ElectronService` exposes typed `aiExplain`, `aiAnalyze`, `getAiProviderUrl`, and `setAiProviderUrl` methods

---

### D7 — TypeScript Contracts

#### Description

Define TypeScript interfaces for all IPC types consumed by Angular. These contracts live in `src\electron.d.ts` and are the authoritative type definitions for all data that crosses the IPC boundary. A companion file, `electron\shared\contracts\ipc-channels.ts`, defines all IPC channel name constants as an enum or const object, ensuring that channel strings are never duplicated as raw strings in handler registrations or Angular callers.

#### Acceptance Criteria
- `src\electron.d.ts` declares interfaces for all request and response shapes that cross the IPC boundary
- Interfaces covered: `ElectronRepository`, `AddRepositoryRequest`, `UpdateRepositoryRequest`, `ElectronAnalysis`, `SaveAnalysisRequest`, `ElectronFileMetadata`, `SyncFileEntry`, `ElectronDirectoryEntry`, `ScanProgressEvent`, and all six namespace APIs (`ElectronRepositoriesAPI`, `ElectronAnalysisAPI`, `ElectronFilesAPI`, `ElectronFilesystemAPI`, `ElectronSettingsAPI`, `ElectronAiAPI`) plus the top-level `ElectronAPI`
- `window.electronAPI` is typed as `ElectronAPI` in the global declaration
- `electron\shared\contracts\ipc-channels.ts` exports all IPC channel name constants
- No IPC channel string is duplicated as a raw literal in both Angular and Electron code
- Angular's `ElectronService` uses the declared interfaces throughout

---

## Definition of Done

Phase 1 is complete when:

1. The Angular application loads inside an Electron `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`
2. All Angular↔Electron communication goes exclusively through `contextBridge` → `ipcRenderer.invoke` → `ipcMain.handle`
3. Every IPC handler uses `wrapHandler()` and returns the standard envelope
4. Repository operations (getAll, add, update, touch, remove) are live end-to-end including Git metadata attachment
5. Git branch and origin URL are read from `.git/HEAD` and `.git/config` without shelling out to Git
6. Directory scanning runs in a `worker_threads` worker with progress events and cancellation support
7. AI explain and analyze operations route through Node.js HTTP engines in the Electron process
8. All IPC types are declared in `src\electron.d.ts` and all channel names are centralized in `ipc-channels.ts`
9. Angular has no direct filesystem access, no direct AI communication, and no Node.js API usage

---

Generated by Rocket Flow · 2.0.20 · 2026-07-08
