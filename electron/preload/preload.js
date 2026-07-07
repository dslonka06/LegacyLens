const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Repository Library ────────────────────────────────────────────────────
  repositories: {
    getAll:   ()                => ipcRenderer.invoke('repositories:getAll'),
    add:      (request)        => ipcRenderer.invoke('repositories:add', request),
    update:   (id, updates)    => ipcRenderer.invoke('repositories:update', id, updates),
    touch:    (id)             => ipcRenderer.invoke('repositories:touch', id),
    remove:   (id)             => ipcRenderer.invoke('repositories:remove', id),
  },

  // ── Analysis ──────────────────────────────────────────────────────────────
  analysis: {
    save:        (data)          => ipcRenderer.invoke('analysis:save', data),
    getLatest:   (repositoryId)  => ipcRenderer.invoke('analysis:getLatest', repositoryId),
    getHistory:  (repositoryId)  => ipcRenderer.invoke('analysis:getHistory', repositoryId),
    delete:      (id)            => ipcRenderer.invoke('analysis:delete', id),
  },

  // ── File Metadata ─────────────────────────────────────────────────────────
  files: {
    sync:            (repositoryId, files)        => ipcRenderer.invoke('files:sync', repositoryId, files),
    getAll:          (repositoryId)               => ipcRenderer.invoke('files:getAll', repositoryId),
    getChanged:      (repositoryId, currentFiles) => ipcRenderer.invoke('files:getChanged', repositoryId, currentFiles),
    clearRepository: (repositoryId)               => ipcRenderer.invoke('files:clearRepository', repositoryId),
  },

  // ── File System ───────────────────────────────────────────────────────────
  filesystem: {
    openDialog:    (options)        => ipcRenderer.invoke('filesystem:openDialog', options),
    readDirectory: (dirPath)        => ipcRenderer.invoke('filesystem:readDirectory', dirPath),
    readFile:      (path)           => ipcRenderer.invoke('filesystem:readFile', path),
    exportPdf:     (path, content)  => ipcRenderer.invoke('filesystem:exportPdf', path, content),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    get:    (key)         => ipcRenderer.invoke('settings:get', key),
    set:    (key, value)  => ipcRenderer.invoke('settings:set', key, value),
    getAll: ()            => ipcRenderer.invoke('settings:getAll'),
    delete: (key)         => ipcRenderer.invoke('settings:delete', key),
  },
});
