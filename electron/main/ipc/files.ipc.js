const { ipcMain } = require('electron');
const { FileMetadataService } = require('../services/files/file-metadata.service');
const { wrapHandler } = require('./ipc-utils');

const fileMetadataService = new FileMetadataService();

function registerFileMetadataHandlers() {
  ipcMain.handle('files:sync', wrapHandler((_event, repositoryId, files) => {
    return fileMetadataService.syncFiles(repositoryId, files);
  }));

  ipcMain.handle('files:getAll', wrapHandler((_event, repositoryId) => {
    return fileMetadataService.getAll(repositoryId);
  }));

  ipcMain.handle('files:getChanged', wrapHandler((_event, repositoryId, currentFiles) => {
    return fileMetadataService.getChangedPaths(repositoryId, currentFiles);
  }));

  ipcMain.handle('files:clearRepository', wrapHandler((_event, repositoryId) => {
    return fileMetadataService.clearRepository(repositoryId);
  }));
}

module.exports = { registerFileMetadataHandlers };
