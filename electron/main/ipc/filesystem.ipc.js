const { ipcMain } = require('electron');

/**
 * File system IPC handlers — Phase 2+
 * Registered in electron/main.js when this module is required.
 */
function registerFilesystemHandlers() {
  ipcMain.handle('filesystem:readFile', async (_event, filePath) => {
    throw new Error('filesystem:readFile not implemented — Phase 2');
  });

  ipcMain.handle('filesystem:exportPdf', async (_event, filePath, content) => {
    throw new Error('filesystem:exportPdf not implemented — Phase 2');
  });

  ipcMain.handle('filesystem:openDialog', async (_event, options) => {
    throw new Error('filesystem:openDialog not implemented — Phase 2');
  });
}

module.exports = { registerFilesystemHandlers };
