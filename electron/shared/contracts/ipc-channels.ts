/**
 * Single source of truth for all IPC channel name strings.
 * Import this in both electron/main/ipc handlers and the Angular preload bridge
 * to prevent typos and keep channel names in sync.
 */
export const IpcChannels = {
  // Repository Library
  REPOSITORIES_GET_ALL: 'repositories:getAll',
  REPOSITORIES_ADD: 'repositories:add',
  REPOSITORIES_REMOVE: 'repositories:remove',

  // Workspace (Phase 2+)
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_ACTIVATE: 'workspace:activate',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_GET_ALL: 'workspace:getAll',

  // Analysis (Phase 2+)
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_GET_RESULT: 'analysis:getResult',

  // File System (Phase 2+)
  FILESYSTEM_READ_FILE: 'filesystem:readFile',
  FILESYSTEM_EXPORT_PDF: 'filesystem:exportPdf',
  FILESYSTEM_OPEN_DIALOG: 'filesystem:openDialog',

  // Settings (Phase 2+)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];
