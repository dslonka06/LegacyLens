const { ipcMain } = require('electron');

/**
 * Settings IPC handlers — Phase 2+
 * Registered in electron/main.js when this module is required.
 */
function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key) => {
    throw new Error('settings:get not implemented — Phase 2');
  });

  ipcMain.handle('settings:set', async (_event, key, value) => {
    throw new Error('settings:set not implemented — Phase 2');
  });
}

module.exports = { registerSettingsHandlers };
