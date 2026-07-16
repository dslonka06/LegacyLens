const { ipcMain, app } = require('electron');
const { wrapHandler } = require('./ipc-utils');

function registerAppHandlers() {
  ipcMain.handle('app:getVersion', wrapHandler(() => app.getVersion()));
}

module.exports = { registerAppHandlers };
