const { ipcMain, app, shell } = require('electron');
const { wrapHandler } = require('./ipc-utils');

function registerAppHandlers() {
  ipcMain.handle('app:getVersion', wrapHandler(() => app.getVersion()));

  ipcMain.handle('app:openExternal', wrapHandler((_event, url) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only http/https URLs are allowed');
    }
    shell.openExternal(url);
  }));
}

module.exports = { registerAppHandlers };
