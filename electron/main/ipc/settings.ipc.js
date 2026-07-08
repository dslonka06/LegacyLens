const { ipcMain } = require('electron');
const { SettingsService } = require('../services/settings/settings.service');
const { wrapHandler } = require('./ipc-utils');

const settingsService = new SettingsService();

function registerSettingsHandlers() {
  ipcMain.handle('settings:get', wrapHandler((_event, key) => {
    return settingsService.get(key);
  }));

  ipcMain.handle('settings:set', wrapHandler((_event, key, value) => {
    settingsService.set(key, value);
  }));

  ipcMain.handle('settings:getAll', wrapHandler(() => {
    return settingsService.getAll();
  }));

  ipcMain.handle('settings:delete', wrapHandler((_event, key) => {
    settingsService.delete(key);
  }));
}

module.exports = { registerSettingsHandlers };
