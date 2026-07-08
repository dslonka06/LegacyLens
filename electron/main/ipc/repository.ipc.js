const { ipcMain } = require('electron');
const { RepositoryLibraryService } = require('../services/repository/repository-library.service');
const { readGitMetadata } = require('../services/git/git-reader.service');
const { wrapHandler } = require('./ipc-utils');

const repositoryService = new RepositoryLibraryService();

function registerRepositoryHandlers() {
  ipcMain.handle('repositories:getAll', wrapHandler(() => {
    return repositoryService.getAll();
  }));

  ipcMain.handle('repositories:add', wrapHandler((_event, request) => {
    const git = readGitMetadata(request.path);
    return repositoryService.add({
      ...request,
      gitBranch: request.gitBranch ?? git.gitBranch,
      gitUrl: request.gitUrl ?? git.gitUrl,
    });
  }));

  ipcMain.handle('repositories:update', wrapHandler((_event, id, updates) => {
    return repositoryService.update(id, updates);
  }));

  ipcMain.handle('repositories:touch', wrapHandler((_event, id) => {
    const repo = repositoryService.getAll().find(r => r.id === id);
    if (repo) {
      const git = readGitMetadata(repo.path);
      if (git.gitBranch || git.gitUrl) {
        repositoryService.update(id, {
          gitBranch: git.gitBranch ?? undefined,
          gitUrl: git.gitUrl ?? undefined,
        });
      }
    }
    return repositoryService.touch(id);
  }));

  ipcMain.handle('repositories:remove', wrapHandler((_event, id) => {
    return repositoryService.remove(id);
  }));
}

module.exports = { registerRepositoryHandlers };
