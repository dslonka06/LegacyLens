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
    explain:          (prompt)                    => invoke('ai:explain', prompt),
    analyze:          (fileName, sourceCode)       => invoke('ai:analyze', fileName, sourceCode),
    chat:             (messages, knowledgeModel)   => invoke('ai:chat', messages, knowledgeModel),
    getProviders:     ()                           => invoke('ai:getProviders'),
    getPresets:       ()                           => invoke('ai:getPresets'),
    getCapabilities:  (presetId)                   => invoke('ai:getCapabilities', presetId),
    discoverModels:   (presetId)                    => invoke('ai:discoverModels', presetId),
    testConnection:   ()                           => invoke('ai:testConnection'),
    setApiKey:        (presetId, plainKey)         => invoke('ai:setApiKey', presetId, plainKey),
    isKeyConfigured:  (presetId)                   => invoke('ai:isKeyConfigured', presetId),
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
    systemUnderstanding:  (model)                             => invoke('intelligence:systemUnderstanding', model),
    hubDirective:         (data)                              => invoke('intelligence:hubDirective', data),
    exploreWorkflows:     (flows)                             => invoke('intelligence:exploreWorkflows', flows),
    learningPath:         (model)                             => invoke('intelligence:learningPath', model),
    discoverDataFlows:    (knowledge, structure)              => invoke('intelligence:discoverDataFlows', knowledge, structure),
    recommendations:      (model)                             => invoke('intelligence:recommendations', model),
    security:             (model)                             => invoke('intelligence:security', model),
    architectureAnalysis: (model)                             => invoke('intelligence:architectureAnalysis', model),
    dataFlowAnalysis:     (model)                             => invoke('intelligence:dataFlowAnalysis', model),
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

  // ── App info ──────────────────────────────────────────────────────────────
  app: {
    getVersion:   () => invoke('app:getVersion'),
    openExternal: (url) => invoke('app:openExternal', url),
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
