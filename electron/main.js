const { app, BrowserWindow } = require('electron');
const path = require('path');

// IPC handlers
const { registerRepositoryHandlers } = require('./main/ipc/repository.ipc');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:4200');
}

app.whenReady().then(() => {
  // Register all IPC handlers before creating the window
  registerRepositoryHandlers();

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
