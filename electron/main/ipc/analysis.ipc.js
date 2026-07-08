const { ipcMain } = require('electron');
const { AnalysisService } = require('../services/analysis/analysis.service');
const { wrapHandler } = require('./ipc-utils');

const analysisService = new AnalysisService();

function registerAnalysisHandlers() {
  ipcMain.handle('analysis:save', wrapHandler((_event, data) => {
    return analysisService.save(data);
  }));

  ipcMain.handle('analysis:getLatest', wrapHandler((_event, repositoryId) => {
    return analysisService.getLatest(repositoryId);
  }));

  ipcMain.handle('analysis:getHistory', wrapHandler((_event, repositoryId) => {
    return analysisService.getHistory(repositoryId);
  }));

  ipcMain.handle('analysis:delete', wrapHandler((_event, id) => {
    return analysisService.delete(id);
  }));
}

module.exports = { registerAnalysisHandlers };
