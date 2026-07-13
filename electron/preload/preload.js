const { contextBridge, ipcRenderer } = require('electron');

/**
 * Unwraps the { success, data, error } envelope returned by all IPC handlers.
 * Throws if success is false so Angular-side callers receive a rejected Promise.
 */
async function invoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.success) throw new Error(result.error ?? `IPC error on channel: ${channel}`);
  return result.data;
}

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Repository Library ────────────────────────────────────────────────────
  repositories: {
    getAll:   ()                => invoke('repositories:getAll'),
    add:      (request)        => invoke('repositories:add', request),
    update:   (id, updates)    => invoke('repositories:update', id, updates),
    touch:    (id)             => invoke('repositories:touch', id),
    remove:   (id)             => invoke('repositories:remove', id),
  },

  // ── Analysis ──────────────────────────────────────────────────────────────
  analysis: {
    save:        (data)          => invoke('analysis:save', data),
    getLatest:   (repositoryId)  => invoke('analysis:getLatest', repositoryId),
    getHistory:  (repositoryId)  => invoke('analysis:getHistory', repositoryId),
    delete:      (id)            => invoke('analysis:delete', id),
  },

  // ── File Metadata ─────────────────────────────────────────────────────────
  files: {
    sync:            (repositoryId, files)        => invoke('files:sync', repositoryId, files),
    getAll:          (repositoryId)               => invoke('files:getAll', repositoryId),
    getChanged:      (repositoryId, currentFiles) => invoke('files:getChanged', repositoryId, currentFiles),
    clearRepository: (repositoryId)               => invoke('files:clearRepository', repositoryId),
  },

  // ── File System ───────────────────────────────────────────────────────────
  filesystem: {
    openDialog:    (options)        => invoke('filesystem:openDialog', options),
    readDirectory: (dirPath)        => invoke('filesystem:readDirectory', dirPath),
    cancelScan:    (scanId)         => invoke('filesystem:cancelScan', scanId),
    readFile:      (path)           => invoke('filesystem:readFile', path),
    exportPdf:     (path, content)  => invoke('filesystem:exportPdf', path, content),
    // Register a listener for scan progress events pushed from the main process.
    // Returns an unsubscribe function — call it to stop listening.
    onScanProgress: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('filesystem:scanProgress', handler);
      return () => ipcRenderer.removeListener('filesystem:scanProgress', handler);
    },
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    get:    (key)         => invoke('settings:get', key),
    set:    (key, value)  => invoke('settings:set', key, value),
    getAll: ()            => invoke('settings:getAll'),
    delete: (key)         => invoke('settings:delete', key),
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  ai: {
    explain:         (prompt)              => invoke('ai:explain', prompt),
    analyze:         (fileName, sourceCode) => invoke('ai:analyze', fileName, sourceCode),
    getProviderUrl:  ()                    => invoke('ai:getProviderUrl'),
    setProviderUrl:  (url)                 => invoke('ai:setProviderUrl', url),
  },

  // ── Intelligence Engine ───────────────────────────────────────────────────
  intelligence: {
    analyzeCode:          (code)                              => invoke('intelligence:analyzeCode', code),
    detectArchitecture:   (structure, graph)                  => invoke('intelligence:detectArchitecture', structure, graph),
    buildDependencyGraph: (sourceFiles)                       => invoke('intelligence:buildDependencyGraph', sourceFiles),
    exploreDependencies:  (graph)                             => invoke('intelligence:exploreDependencies', graph),
    detectTechnologies:   (files)                             => invoke('intelligence:detectTechnologies', files),
    discoverProjects:     (files)                             => invoke('intelligence:discoverProjects', files),
    scanRepository:       (files)                             => invoke('intelligence:scanRepository', files),
    classifyWorkspace:    (files)                             => invoke('intelligence:classifyWorkspace', files),
    systemUnderstanding:  (session, knowledge)                => invoke('intelligence:systemUnderstanding', session, knowledge),
    exploreWorkflows:     (flows)                             => invoke('intelligence:exploreWorkflows', flows),
    learningPath:         (session, knowledge, understanding, scope) => invoke('intelligence:learningPath', session, knowledge, understanding, scope),
    discoverDataFlows:    (knowledge, structure)              => invoke('intelligence:discoverDataFlows', knowledge, structure),
    recommendations:      (session, knowledge)                => invoke('intelligence:recommendations', session, knowledge),
    security:             (session, knowledge)                => invoke('intelligence:security', session, knowledge),
    insights:             (knowledge)                         => invoke('intelligence:insights', knowledge),
    buildSummary:         (workspaceContext, knowledge, session) => invoke('intelligence:buildSummary', workspaceContext, knowledge, session),
    runPipeline:          (targetType, files)                   => invoke('intelligence:runPipeline', targetType, files),
    capabilitiesFor:      (targetType)                          => invoke('intelligence:capabilitiesFor', targetType),
    buildKnowledgeModel:  (targetType, files, options)          => invoke('intelligence:buildKnowledgeModel', targetType, files, options),
    getKnowledgeModel:    (repositoryId)                        => invoke('intelligence:getKnowledgeModel', repositoryId),
    buildContext:         (contextType, knowledgeModel, extras) => invoke('intelligence:buildContext', contextType, knowledgeModel, extras),
    checkIncremental:     (repositoryId, currentFiles, targetType) => invoke('intelligence:checkIncremental', repositoryId, currentFiles, targetType),
    processWorkspace:     (request)                            => invoke('intelligence:processWorkspace', request),
  },

  // ── Validation ────────────────────────────────────────────────────────────
  validation: {
    detectTarget: (targetPath) => invoke('validation:detectTarget', targetPath),
  },

  // ── Workspaces ────────────────────────────────────────────────────────────
  workspaces: {
    getAll: ()            => invoke('workspaces:getAll'),
    save:   (workspace)   => invoke('workspaces:save', workspace),
    delete: (id)          => invoke('workspaces:delete', id),
  },

  // ── Auto-updater ──────────────────────────────────────────────────────────
  updater: {
    checkForUpdates:  ()  => invoke('updater:checkForUpdates'),
    downloadUpdate:   ()  => invoke('updater:downloadUpdate'),
    installAndRestart: () => invoke('updater:installAndRestart'),

    onUpdateAvailable: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('updater:updateAvailable', h);
      return () => ipcRenderer.removeListener('updater:updateAvailable', h);
    },
    onUpdateNotAvailable: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('updater:updateNotAvailable', h);
      return () => ipcRenderer.removeListener('updater:updateNotAvailable', h);
    },
    onDownloadProgress: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('updater:downloadProgress', h);
      return () => ipcRenderer.removeListener('updater:downloadProgress', h);
    },
    onUpdateDownloaded: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('updater:updateDownloaded', h);
      return () => ipcRenderer.removeListener('updater:updateDownloaded', h);
    },
  },
});
