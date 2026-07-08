const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { wrapHandler } = require('./ipc-utils');

function detectTargetType(targetPath) {
  try {
    const stat = fs.statSync(targetPath);

    if (stat.isFile()) {
      return 'file';
    }

    if (stat.isDirectory()) {
      const gitPath = path.join(targetPath, '.git');
      try {
        const gitStat = fs.statSync(gitPath);
        if (gitStat.isDirectory()) return 'repository';
      } catch { /* .git not found */ }
      return 'folder';
    }

    return 'unknown';
  } catch {
    return 'invalid';
  }
}

function registerValidationHandlers() {
  ipcMain.handle('validation:detectTarget', wrapHandler((_event, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') throw new Error('targetPath is required');
    const detected = detectTargetType(targetPath);
    return { path: targetPath, detected };
  }));
}

module.exports = { registerValidationHandlers };
