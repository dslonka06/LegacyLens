# Preload

The contextBridge layer between Electron main and Angular renderer.

preload.js exposes window.electronAPI — the ONLY way Angular should
communicate with Electron. No direct Node.js API access from Angular.

All exposed methods map to IPC channel names defined in:
  electron/shared/contracts/ipc-channels.ts
