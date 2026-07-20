const { ipcMain } = require('electron');
const { getDatabase } = require('../database/database');
const { wrapHandler } = require('./ipc-utils');

function registerWorkspaceHandlers() {
  ipcMain.handle('workspaces:getAll', wrapHandler(() => {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM workspaces ORDER BY last_modified_at DESC').all();
    return rows.map(rowToWorkspace);
  }));

  ipcMain.handle('workspaces:save', wrapHandler((_event, workspace) => {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO workspaces (id, name, type, status, created_at, last_modified_at, repository_id, path, knowledge_model)
      VALUES (@id, @name, @type, @status, @createdAt, @lastModifiedAt, @repositoryId, @path, @knowledgeModel)
      ON CONFLICT(id) DO UPDATE SET
        name             = excluded.name,
        type             = excluded.type,
        status           = excluded.status,
        last_modified_at = excluded.last_modified_at,
        repository_id    = excluded.repository_id,
        path             = excluded.path,
        knowledge_model  = excluded.knowledge_model
    `).run({
      id:             workspace.id,
      name:           workspace.name,
      type:           workspace.type,
      status:         workspace.status,
      createdAt:      workspace.createdAt,
      lastModifiedAt: workspace.lastModifiedAt,
      repositoryId:   workspace.repositoryId ?? null,
      path:           workspace.path ?? null,
      knowledgeModel: workspace.knowledgeModel != null
        ? JSON.stringify(workspace.knowledgeModel)
        : null,
    });
    return rowToWorkspace(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace.id));
  }));

  ipcMain.handle('workspaces:delete', wrapHandler((_event, id) => {
    const db = getDatabase();
    const info = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return info.changes > 0;
  }));
}

function rowToWorkspace(row) {
  return {
    id:             row.id,
    name:           row.name,
    type:           row.type,
    status:         row.status,
    createdAt:      row.created_at,
    lastModifiedAt: row.last_modified_at,
    repositoryId:   row.repository_id ?? null,
    path:           row.path ?? null,
    knowledgeModel: row.knowledge_model ? JSON.parse(row.knowledge_model) : null,
  };
}

module.exports = { registerWorkspaceHandlers };
