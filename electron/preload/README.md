# Preload

The contextBridge layer between Electron main and the Angular renderer.

`preload.js` exposes `window.electronAPI` — the only communication path between
Angular and Electron. No direct Node.js API access from Angular.

## Namespaces exposed

- `app` — version info
- `repositories` — repository library CRUD
- `analysis` — analysis result persistence
- `files` — file metadata sync
- `filesystem` — directory reads, native dialogs, scan progress
- `settings` — read/write application settings
- `intelligence` — analysis engine pipeline (scan, knowledge build, AI stages)
- `ai` — AI provider calls, model discovery, key management
- `workspaces` — workspace persistence
- `validation` — target type detection
