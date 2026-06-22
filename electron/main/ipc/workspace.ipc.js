const { ipcMain } = require('electron');

/**
 * Workspace IPC handlers — Phase 2+
 * Registered in electron/main.js when this module is required.
 */
function registerWorkspaceHandlers() {
  ipcMain.handle('workspace:create', async (_event, type) => {
    throw new Error('workspace:create not implemented — Phase 2');
  });

  ipcMain.handle('workspace:activate', async (_event, id) => {
    throw new Error('workspace:activate not implemented — Phase 2');
  });

  ipcMain.handle('workspace:delete', async (_event, id) => {
    throw new Error('workspace:delete not implemented — Phase 2');
  });

  ipcMain.handle('workspace:getAll', async () => {
    throw new Error('workspace:getAll not implemented — Phase 2');
  });
}

module.exports = { registerWorkspaceHandlers };
