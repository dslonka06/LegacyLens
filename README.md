# SystemLens

SystemLens is a desktop application for codebase analysis and developer onboarding. It helps engineers understand unfamiliar software systems faster by transforming repositories into structured, AI-augmented knowledge.

---

## What it does

- Analyzes files, folders, and complete repositories
- Discovers technologies, frameworks, dependencies, and architectural patterns
- Generates AI-powered summaries: system understanding, architecture, security, data flow, learning paths, and recommendations
- Provides an interactive AI chat panel with full repository context
- Exports documentation and analysis reports as PDF

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| Frontend | Angular 21, TypeScript, SCSS |
| AI providers | Anthropic (Claude), Ollama (local models) |
| Persistence | SQLite (better-sqlite3) |
| Build/package | electron-builder |

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Run in development (Electron)

```bash
# Build the Angular app, then launch Electron
npm run build && npm run electron
```

> `ng serve` / `npm start` launches the Angular dev server in a browser without Electron. AI features, file system access, and persistence will not work. The app is Electron-only.

### Package for distribution

```bash
# Package without installer (faster, for testing)
npm run dist:dir

# Full installer build
npm run dist
```

Build artifacts are written to `dist/`.

---

## AI Configuration

SystemLens supports two AI providers, configured in Settings:

| Provider | Auth | Notes |
|----------|------|-------|
| **Anthropic** | API key (encrypted via OS keychain) | Claude Sonnet, Opus, Haiku |
| **Ollama** | None — local only | Any model installed via `ollama pull` |

At least one provider must be configured for AI features to work. Ollama requires [Ollama](https://ollama.com) running locally.

---

## Project Structure

```
electron/           Electron main process
  main/
    engines/        Analysis and AI engine implementations
    ipc/            IPC channel registrations
    providers/      AI provider implementations (Anthropic, Ollama)
    services/       Settings, filesystem, repository, workspace
  preload/          contextBridge (window.electronAPI)
  shared/           Types and contracts shared across the boundary

src/                Angular renderer
  app/
    ai/             Prompt builders and AI analysis service
    analysis/       Analysis services and page components
    core/           App config, ElectronService bridge, shared services
    features/       Page-level feature modules (settings, analysis views)
    knowledge/      KnowledgeModel types and workspace knowledge service
    shell/          App shell, AI chat panel
    workspace/      Workspace state management
```
