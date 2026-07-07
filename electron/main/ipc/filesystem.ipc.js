const { ipcMain, dialog } = require('electron');

function registerFilesystemHandlers() {
  ipcMain.handle('filesystem:openDialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(options ?? {});
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('filesystem:readFile', async (_event, filePath) => {
    throw new Error('filesystem:readFile not implemented — Phase 2');
  });

  ipcMain.handle('filesystem:exportPdf', async (_event, filePath, content) => {
    throw new Error('filesystem:exportPdf not implemented — Phase 2');
  });
}

module.exports = { registerFilesystemHandlers };
