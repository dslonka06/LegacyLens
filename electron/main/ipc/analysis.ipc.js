const { ipcMain } = require('electron');

/**
 * Analysis IPC handlers — Phase 2+
 * Registered in electron/main.js when this module is required.
 */
function registerAnalysisHandlers() {
  ipcMain.handle('analysis:run', async (_event, workspaceId, options) => {
    throw new Error('analysis:run not implemented — Phase 2');
  });

  ipcMain.handle('analysis:getResult', async (_event, workspaceId) => {
    throw new Error('analysis:getResult not implemented — Phase 2');
  });
}

module.exports = { registerAnalysisHandlers };
