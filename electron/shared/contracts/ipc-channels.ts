/**
 * Single source of truth for all IPC channel name strings.
 * Import this in both electron/main/ipc handlers and the Angular preload bridge
 * to prevent typos and keep channel names in sync.
 */
export const IpcChannels = {
  // ── Repository Library ────────────────────────────────────────────────────
  REPOSITORIES_GET_ALL: 'repositories:getAll',
  REPOSITORIES_ADD:     'repositories:add',
  REPOSITORIES_UPDATE:  'repositories:update',
  REPOSITORIES_TOUCH:   'repositories:touch',
  REPOSITORIES_REMOVE:  'repositories:remove',

  // ── Analysis (SQLite) ─────────────────────────────────────────────────────
  ANALYSIS_SAVE:        'analysis:save',
  ANALYSIS_GET_LATEST:  'analysis:getLatest',
  ANALYSIS_GET_HISTORY: 'analysis:getHistory',
  ANALYSIS_DELETE:      'analysis:delete',

  // ── File Metadata ─────────────────────────────────────────────────────────
  FILES_SYNC:             'files:sync',
  FILES_GET_ALL:          'files:getAll',
  FILES_GET_CHANGED:      'files:getChanged',
  FILES_CLEAR_REPOSITORY: 'files:clearRepository',

  // ── File System ───────────────────────────────────────────────────────────
  FILESYSTEM_OPEN_DIALOG:    'filesystem:openDialog',
  FILESYSTEM_READ_DIRECTORY: 'filesystem:readDirectory',
  FILESYSTEM_CANCEL_SCAN:    'filesystem:cancelScan',
  FILESYSTEM_READ_FILE:      'filesystem:readFile',
  FILESYSTEM_EXPORT_PDF:     'filesystem:exportPdf',

  // ── Settings ──────────────────────────────────────────────────────────────
  SETTINGS_GET:    'settings:get',
  SETTINGS_SET:    'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_DELETE: 'settings:delete',

  // ── AI (Phase 3) ──────────────────────────────────────────────────────────
  AI_EXPLAIN:          'ai:explain',
  AI_ANALYZE:          'ai:analyze',
  AI_GET_PROVIDER_URL: 'ai:getProviderUrl',
  AI_SET_PROVIDER_URL: 'ai:setProviderUrl',

  // ── Intelligence Engine (Phase 4) ─────────────────────────────────────────
  INTELLIGENCE_ANALYZE_CODE:          'intelligence:analyzeCode',
  INTELLIGENCE_DETECT_ARCHITECTURE:   'intelligence:detectArchitecture',
  INTELLIGENCE_BUILD_DEPENDENCY_GRAPH:'intelligence:buildDependencyGraph',
  INTELLIGENCE_EXPLORE_DEPENDENCIES:  'intelligence:exploreDependencies',
  INTELLIGENCE_DETECT_TECHNOLOGIES:   'intelligence:detectTechnologies',
  INTELLIGENCE_DISCOVER_PROJECTS:     'intelligence:discoverProjects',
  INTELLIGENCE_SCAN_REPOSITORY:       'intelligence:scanRepository',
  INTELLIGENCE_CLASSIFY_WORKSPACE:    'intelligence:classifyWorkspace',
  INTELLIGENCE_SYSTEM_UNDERSTANDING:  'intelligence:systemUnderstanding',
  INTELLIGENCE_EXPLORE_WORKFLOWS:     'intelligence:exploreWorkflows',
  INTELLIGENCE_LEARNING_PATH:         'intelligence:learningPath',
  INTELLIGENCE_DISCOVER_DATA_FLOWS:   'intelligence:discoverDataFlows',
  INTELLIGENCE_RECOMMENDATIONS:       'intelligence:recommendations',
  INTELLIGENCE_SECURITY:              'intelligence:security',
  INTELLIGENCE_INSIGHTS:              'intelligence:insights',
  INTELLIGENCE_BUILD_SUMMARY:         'intelligence:buildSummary',
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];
