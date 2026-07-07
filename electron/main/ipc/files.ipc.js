const { ipcMain } = require('electron');
const { FileMetadataService } = require('../services/files/file-metadata.service');

const fileMetadataService = new FileMetadataService();

function registerFileMetadataHandlers() {
  ipcMain.handle('files:sync', (_event, repositoryId, files) => {
    return fileMetadataService.syncFiles(repositoryId, files);
  });

  ipcMain.handle('files:getAll', (_event, repositoryId) => {
    return fileMetadataService.getAll(repositoryId);
  });

  ipcMain.handle('files:getChanged', (_event, repositoryId, currentFiles) => {
    return fileMetadataService.getChangedPaths(repositoryId, currentFiles);
  });

  ipcMain.handle('files:clearRepository', (_event, repositoryId) => {
    return fileMetadataService.clearRepository(repositoryId);
  });
}

module.exports = { registerFileMetadataHandlers };
