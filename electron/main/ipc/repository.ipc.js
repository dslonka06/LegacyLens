const { ipcMain } = require('electron');
const { RepositoryLibraryService } = require('../services/repository/repository-library.service');

const repositoryService = new RepositoryLibraryService();

/**
 * Repository Library IPC handlers.
 * Phase 1 proof-of-concept: validates that the full IPC pipe works
 * (contextBridge → ipcRenderer.invoke → ipcMain.handle → service → response).
 *
 * Phase 2: RepositoryLibraryService will persist to SQLite instead of in-memory.
 */
function registerRepositoryHandlers() {
  ipcMain.handle('repositories:getAll', async () => {
    return repositoryService.getAll();
  });

  ipcMain.handle('repositories:add', async (_event, request) => {
    return repositoryService.add(request);
  });

  ipcMain.handle('repositories:remove', async (_event, id) => {
    return repositoryService.remove(id);
  });
}

module.exports = { registerRepositoryHandlers };
