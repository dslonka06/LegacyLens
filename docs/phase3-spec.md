# Phase 3 — AI Platform Integration
## Formal Specification

---

## Objective

Move all AI HTTP transport into the Electron main process. Angular no longer makes direct HTTP calls to the AI provider. Instead, Angular sends prompts via IPC, Electron resolves the provider URL from settings, and Electron performs the HTTP request. The provider base URL is user-configurable from the settings page.

Phase 3 is the third layer of the SystemLens platform migration. Phase 1 established the Electron shell and IPC infrastructure. Phase 2 added SQLite persistence. Phase 3 uses both of those foundations — IPC channels carry AI requests, SQLite stores the provider URL — to fully decouple Angular from the AI provider.

---

## Architectural Principles

**Angular Never Touches the Network for AI**
All AI HTTP calls originate from the Electron main process. Angular is only responsible for constructing a prompt and rendering the response.

**IPC as the Transport Boundary**
The IPC channel is the single interface between Angular and the Electron AI layer. No AI-specific HTTP client code lives in Angular after this phase.

**Graceful Browser Fallback**
Angular services retain a direct HTTP fallback path for browser mode. This preserves developer tooling and ensures the application is not hard-coupled to Electron for non-production workflows.

**Provider URL as a Setting**
The AI provider base URL is not hardcoded. It is stored in SQLite via the Phase 2 settings service and is editable by the user at runtime through the settings page.

**No AI in Knowledge Generation**
Consistent with Phase 4 intent, AI consumes structured input — it does not participate in parsing or knowledge generation. Phase 3 does not change this boundary; it only changes where the HTTP call is made.

---

## Responsibility Split

### Angular
- Constructing AI prompts from existing analysis context
- Routing AI requests through IPC when running in Electron
- Falling back to direct HTTP in browser mode
- Rendering AI responses in the UI
- Providing a settings UI for the provider URL

### Electron
- Resolving the provider base URL from SQLite settings
- Performing all AI HTTP requests via Node.js `http`/`https`
- Parsing and returning AI provider responses to Angular via IPC
- Exposing `ai:explain`, `ai:analyze`, `ai:getProviderUrl`, and `ai:setProviderUrl` IPC channels

### SQLite
- Storing the user-configured AI provider base URL as an application setting

---

## Deliverables

---

### D1 — Angular AI Services Route via IPC

#### Description

`AiKnowledgeService` and `AiAnalysisService` detect whether the application is running inside Electron and, if so, delegate all AI calls to the Electron main process via IPC rather than making direct HTTP requests. Browser mode behavior is unchanged.

`AiKnowledgeService.callApi(prompt)`:
- Electron: `from(electron.aiExplain(prompt))` via IPC
- Browser: direct HTTP POST (existing behavior)

`AiAnalysisService.analyze(fileName, sourceCode)`:
- Electron: `from(electron.aiAnalyze(fileName, sourceCode)).pipe(map(r => r as AiAnalysisResult))`
- Browser: direct HTTP POST (existing behavior)

#### Acceptance Criteria
- In Electron mode, `AiKnowledgeService` sends all prompts via IPC and never makes a direct HTTP call to the AI provider
- In Electron mode, `AiAnalysisService` sends all analysis requests via IPC and never makes a direct HTTP call
- In browser mode, both services fall back to their original direct HTTP behavior without modification
- The Angular services do not contain any Node.js-specific code
- No change in user-facing behavior — AI responses are functionally identical regardless of transport path

---

### D2 — Electron Main Process AI Engines

#### Description

Two engine classes handle AI HTTP transport inside the Electron main process. Both accept a `settingsService` dependency and resolve the provider base URL from settings at call time, defaulting to `http://localhost:5000` if no URL is configured.

**`AiKnowledgeEngine`** (`electron/main/engines/ai/knowledge.engine.js`):
- `explain(prompt)` — resolves the provider URL, calls `callProvider()`, returns the explanation string
- `callProvider(url, prompt)` — performs a Node.js HTTP/HTTPS request with JSON body `{ prompt }`, parses `{ explanation }` from the response, enforces a 5-minute timeout

**`AiAnalysisEngine`** (`electron/main/engines/ai/analysis.engine.js`):
- `analyze(fileName, sourceCode)` — resolves the provider URL, calls `callProvider()`, returns a parsed `AiAnalysisResult`

#### Acceptance Criteria
- Both engine classes are instantiated with a `settingsService` dependency; no URL is hardcoded in the engine constructor
- The provider URL is resolved from settings on every call; changes to the URL take effect without restarting the application
- `callProvider()` uses only Node.js built-in `http`/`https` — no third-party HTTP client is introduced
- The 5-minute timeout is enforced and surfaces a descriptive error if exceeded
- JSON parsing errors from the provider are caught and returned as structured error responses, not unhandled exceptions
- Both engines reside under `electron/main/engines/ai/`

---

### D3 — AI IPC Handlers

#### Description

Four IPC handlers are registered via `registerAiHandlers()` in `electron/main/ipc/ai.ipc.js`. The function is called inside `app.whenReady()` in `electron/main.js`.

| Channel | Input | Output |
|---|---|---|
| `ai:explain` | `prompt: string` | `Promise<string>` |
| `ai:analyze` | `fileName: string, sourceCode: string` | `Promise<AiAnalysisResult>` |
| `ai:getProviderUrl` | — | `Promise<string \| null>` |
| `ai:setProviderUrl` | `url: string \| null` | `Promise<void>` |

`ai:explain` validates that the incoming prompt is a non-empty string before delegating to `AiKnowledgeEngine`. `ai:analyze` delegates directly to `AiAnalysisEngine`.

#### Acceptance Criteria
- All four IPC channels are registered and respond correctly
- `ai:explain` rejects with a descriptive error if the prompt is missing or not a string
- `registerAiHandlers()` is called from `electron/main.js` inside `app.whenReady()`
- Handler failures are caught and returned as rejected promises rather than crashing the main process
- No AI logic is duplicated between handlers and engines — handlers are thin dispatch layers only

---

### D4 — Provider URL Configurable via Settings Page

#### Description

The AI provider base URL is stored in SQLite via the Phase 2 settings service and is editable by the user from the settings page without restarting the application.

**`ElectronService`** gains four methods that delegate to the preload `ai` namespace:
- `aiExplain(prompt)`
- `aiAnalyze(fileName, sourceCode)`
- `getAiProviderUrl()`
- `setAiProviderUrl(url)`

**`settings-page.ts`** adds an `aiProviderUrl` field. On `ngOnInit`, the current URL is loaded via `Promise.all([getAllSettings(), getAiProviderUrl()])`. On save, the URL is written via `Promise.all([setSetting('aiProvider'), setSetting('aiModel'), setAiProviderUrl()])`.

**`settings-page.html`** adds a provider URL input field between the Model field and the Save button. Placeholder text: `http://localhost:5000`. Description: "Base URL for the AI backend".

#### Acceptance Criteria
- The settings page loads and displays the current provider URL on open
- Saving the settings page persists the URL to SQLite and takes effect immediately for subsequent AI calls
- Clearing the URL field and saving resets the provider to the engine's default (`http://localhost:5000`)
- The URL input is visible between the Model field and the Save button
- `ElectronService` methods return `null`-safe values and do not throw when called in browser mode

---

### D5 — Preload Exposes AI Namespace

#### Description

The `electron/preload/preload.js` file exposes an `ai` namespace on the `window` object via `contextBridge.exposeInMainWorld`. All four AI IPC channels are accessible through this namespace from the Angular renderer process.

```javascript
ai: {
  explain:        (prompt)               => ipcRenderer.invoke('ai:explain', prompt),
  analyze:        (fileName, sourceCode) => ipcRenderer.invoke('ai:analyze', fileName, sourceCode),
  getProviderUrl: ()                     => ipcRenderer.invoke('ai:getProviderUrl'),
  setProviderUrl: (url)                  => ipcRenderer.invoke('ai:setProviderUrl', url),
}
```

#### Acceptance Criteria
- All four methods are exposed under the `ai` key in the contextBridge namespace
- The preload script uses `contextBridge.exposeInMainWorld` — direct `window` assignment is not used
- No AI logic executes in the preload script; it is a pure forwarding layer
- The `ai` namespace is available to Angular immediately on application load

---

### D6 — TypeScript Contracts for ElectronAiAPI

#### Description

`src/electron.d.ts` declares the `ElectronAiAPI` interface and adds it to the top-level `ElectronAPI` interface. Angular services reference typed IPC methods rather than casting to `any` or using untyped access.

```typescript
interface ElectronAiAPI {
  explain(prompt: string): Promise<string>;
  analyze(fileName: string, sourceCode: string): Promise<unknown>;
  getProviderUrl(): Promise<string | null>;
  setProviderUrl(url: string | null): Promise<void>;
}
```

`ElectronAPI.ai` is typed as `ElectronAiAPI`.

#### Acceptance Criteria
- `ElectronAiAPI` is declared in `src/electron.d.ts`
- `ElectronAPI.ai` is typed as `ElectronAiAPI`
- All four methods carry accurate parameter and return types
- Angular services that call `electron.ai.*` methods compile without type errors
- No `any` casts are required to call AI IPC methods from Angular

---

## Definition of Done

Phase 3 is complete when:

1. All AI HTTP requests, when running in Electron, originate from the Electron main process and not from Angular
2. `AiKnowledgeService` and `AiAnalysisService` route through IPC in Electron mode and fall back to direct HTTP in browser mode
3. `AiKnowledgeEngine` and `AiAnalysisEngine` perform all provider HTTP calls using Node.js built-ins with a 5-minute timeout
4. All four IPC channels — `ai:explain`, `ai:analyze`, `ai:getProviderUrl`, `ai:setProviderUrl` — are registered and functioning
5. The AI provider base URL is stored in SQLite, defaults to `http://localhost:5000`, and is editable from the settings page without restarting the application
6. The preload script exposes the `ai` namespace via `contextBridge` with all four methods
7. TypeScript contracts for `ElectronAiAPI` are declared in `src/electron.d.ts` and all Angular callers compile cleanly

---

Generated by Rocket Flow · 2.0.20 · 2026-07-08
