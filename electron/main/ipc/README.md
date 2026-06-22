# IPC Handlers

This directory contains all Electron IPC channel registrations.

Each file corresponds to a domain and registers `ipcMain.handle()` calls
that Angular invokes via the contextBridge-exposed `window.electronAPI`.

Files:
- `repository.ipc.ts` — repository library: add, get, remove
- `workspace.ipc.ts` — workspace lifecycle: create, activate, delete
- `analysis.ipc.ts` — run analysis engines, retrieve results
- `filesystem.ipc.ts` — file reads, PDF export, native file dialogs
- `settings.ipc.ts` — read/write application settings

All channel name strings live in `electron/shared/contracts/ipc-channels.ts`.
