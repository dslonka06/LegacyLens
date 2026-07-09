const { app, BrowserWindow } = require('electron');
const path = require('path');

const { openDatabase } = require('./main/database/database');
const { registerRepositoryHandlers } = require('./main/ipc/repository.ipc');
const { registerFilesystemHandlers } = require('./main/ipc/filesystem.ipc');
const { registerAnalysisHandlers } = require('./main/ipc/analysis.ipc');
const { registerFileMetadataHandlers } = require('./main/ipc/files.ipc');
const { registerSettingsHandlers } = require('./main/ipc/settings.ipc');
const { registerAiHandlers } = require('./main/ipc/ai.ipc');
const { registerIntelligenceHandlers } = require('./main/ipc/intelligence.ipc');
const { registerValidationHandlers } = require('./main/ipc/validation.ipc');
const { registerWorkspaceHandlers } = require('./main/ipc/workspace.ipc');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'browser', 'index.html'));
  } else {
    win.loadURL('http://localhost:4200');
  }
}

app.whenReady().then(() => {
  openDatabase();

  registerRepositoryHandlers();
  registerFilesystemHandlers();
  registerAnalysisHandlers();
  registerFileMetadataHandlers();
  registerSettingsHandlers();
  registerAiHandlers();
  registerIntelligenceHandlers();
  registerValidationHandlers();
  registerWorkspaceHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
