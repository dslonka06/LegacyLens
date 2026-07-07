const { ipcMain } = require('electron');
const { AnalysisService } = require('../services/analysis/analysis.service');

const analysisService = new AnalysisService();

function registerAnalysisHandlers() {
  ipcMain.handle('analysis:save', (_event, data) => {
    return analysisService.save(data);
  });

  ipcMain.handle('analysis:getLatest', (_event, repositoryId) => {
    return analysisService.getLatest(repositoryId);
  });

  ipcMain.handle('analysis:getHistory', (_event, repositoryId) => {
    return analysisService.getHistory(repositoryId);
  });

  ipcMain.handle('analysis:delete', (_event, id) => {
    return analysisService.delete(id);
  });
}

module.exports = { registerAnalysisHandlers };
