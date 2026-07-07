const { ipcMain } = require('electron');
const { SettingsService } = require('../services/settings/settings.service');

const settingsService = new SettingsService();

function registerSettingsHandlers() {
  ipcMain.handle('settings:get', (_event, key) => {
    return settingsService.get(key);
  });

  ipcMain.handle('settings:set', (_event, key, value) => {
    settingsService.set(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    return settingsService.getAll();
  });

  ipcMain.handle('settings:delete', (_event, key) => {
    settingsService.delete(key);
  });
}

module.exports = { registerSettingsHandlers };
