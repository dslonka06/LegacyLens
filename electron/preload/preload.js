const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes window.electronAPI to the Angular renderer.
 * This is the ONLY communication channel between Angular and Electron.
 * No Node.js APIs are exposed directly.
 *
 * Channel names match IpcChannels constants in electron/shared/contracts/ipc-channels.ts
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Repository Library ────────────────────────────────────────────────────
  repositories: {
    getAll: () => ipcRenderer.invoke('repositories:getAll'),
    add: (request) => ipcRenderer.invoke('repositories:add', request),
    remove: (id) => ipcRenderer.invoke('repositories:remove', id),
  },

  // ── Workspace (Phase 2+) ──────────────────────────────────────────────────
  workspace: {
    create: (type) => ipcRenderer.invoke('workspace:create', type),
    activate: (id) => ipcRenderer.invoke('workspace:activate', id),
    delete: (id) => ipcRenderer.invoke('workspace:delete', id),
    getAll: () => ipcRenderer.invoke('workspace:getAll'),
  },

  // ── Analysis (Phase 2+) ───────────────────────────────────────────────────
  analysis: {
    run: (workspaceId, options) => ipcRenderer.invoke('analysis:run', workspaceId, options),
    getResult: (workspaceId) => ipcRenderer.invoke('analysis:getResult', workspaceId),
  },

  // ── File System (Phase 2+) ────────────────────────────────────────────────
  filesystem: {
    readFile: (path) => ipcRenderer.invoke('filesystem:readFile', path),
    exportPdf: (path, content) => ipcRenderer.invoke('filesystem:exportPdf', path, content),
    openDialog: (options) => ipcRenderer.invoke('filesystem:openDialog', options),
  },

  // ── Settings (Phase 2+) ───────────────────────────────────────────────────
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },
});
