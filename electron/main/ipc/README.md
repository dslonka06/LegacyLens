# IPC Handlers

All Electron IPC channel registrations live here. Each file covers one domain
and registers `ipcMain.handle()` calls that Angular invokes via `window.electronAPI`.

## Files

- `repository.ipc.js` — repository library: add, get, update, remove, touch
- `analysis.ipc.js` — save/retrieve analysis results
- `filesystem.ipc.js` — file reads, directory scanning, PDF export, native dialogs
- `settings.ipc.js` — read/write application settings
- `intelligence.ipc.js` — all analysis engine calls (repository scan, knowledge build, AI stages)
- `ai.ipc.js` — AI provider calls: explain, analyze, chat, provider management, key storage
- `workspace.ipc.js` — workspace persistence: save, get, delete

All channel name strings live in `electron/shared/contracts/ipc-channels.ts`.
