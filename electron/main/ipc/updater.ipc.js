const { ipcMain, BrowserWindow } = require('electron');
const { autoUpdater }            = require('electron-updater');

let updateAvailableInfo  = null;
let updateDownloadedInfo = null;

function registerUpdaterHandlers() {
  // ── autoUpdater configuration ────────────────────────────────────────────
  autoUpdater.autoDownload    = false; // renderer decides when to download
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Push events to all renderer windows ─────────────────────────────────
  function broadcast(channel, payload) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    });
  }

  autoUpdater.on('update-available', info => {
    updateAvailableInfo = info;
    broadcast('updater:updateAvailable', { version: info.version, releaseNotes: info.releaseNotes ?? null });
  });

  autoUpdater.on('update-not-available', () => {
    broadcast('updater:updateNotAvailable', {});
  });

  autoUpdater.on('download-progress', progress => {
    broadcast('updater:downloadProgress', {
      percent:           Math.round(progress.percent),
      transferred:       progress.transferred,
      total:             progress.total,
      bytesPerSecond:    progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', info => {
    updateDownloadedInfo = info;
    broadcast('updater:updateDownloaded', { version: info.version });
  });

  autoUpdater.on('error', err => {
    // Non-fatal — log only; renderer doesn't need to surface updater errors
    console.error('[updater] error:', err?.message ?? err);
  });

  // ── IPC handlers called by the renderer ─────────────────────────────────
  ipcMain.handle('updater:checkForUpdates', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: err?.message ?? 'Check failed' };
    }
  });

  ipcMain.handle('updater:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: err?.message ?? 'Download failed' };
    }
  });

  ipcMain.handle('updater:installAndRestart', () => {
    // setImmediate so the IPC reply is sent before the process exits
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { success: true, data: null };
  });
}

module.exports = { registerUpdaterHandlers };
