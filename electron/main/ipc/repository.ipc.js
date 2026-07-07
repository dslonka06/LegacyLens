const { ipcMain } = require('electron');
const { RepositoryLibraryService } = require('../services/repository/repository-library.service');

const repositoryService = new RepositoryLibraryService();

function registerRepositoryHandlers() {
  ipcMain.handle('repositories:getAll', () => {
    return repositoryService.getAll();
  });

  ipcMain.handle('repositories:add', (_event, request) => {
    return repositoryService.add(request);
  });

  ipcMain.handle('repositories:update', (_event, id, updates) => {
    return repositoryService.update(id, updates);
  });

  ipcMain.handle('repositories:touch', (_event, id) => {
    return repositoryService.touch(id);
  });

  ipcMain.handle('repositories:remove', (_event, id) => {
    return repositoryService.remove(id);
  });
}

module.exports = { registerRepositoryHandlers };
