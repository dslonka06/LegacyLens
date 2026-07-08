const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { wrapHandler } = require('./ipc-utils');

const WORKER_PATH = path.join(__dirname, '..', 'workers', 'filesystem.worker.js');

// Active scan workers keyed by scanId — used for cancellation
const activeScans = new Map();

function registerFilesystemHandlers() {
  ipcMain.handle('filesystem:openDialog', wrapHandler(async (_event, options) => {
    const result = await dialog.showOpenDialog(options ?? {});
    return result.canceled ? null : result.filePaths;
  }));

  // Runs the directory walk in a worker thread so the main thread stays unblocked.
  // Sends 'filesystem:scanProgress' pushes to the renderer as files accumulate.
  // Returns the complete file list when the worker finishes.
  ipcMain.handle('filesystem:readDirectory', (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: true, data: [] };
    }

    const scanId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sender = _event.sender;

    return new Promise((resolve) => {
      const results = [];

      const worker = new Worker(WORKER_PATH, { workerData: { dirPath } });
      activeScans.set(scanId, worker);

      worker.on('message', (msg) => {
        if (msg.type === 'file') {
          results.push(msg.file);
        } else if (msg.type === 'progress') {
          // Push progress event to renderer — fire-and-forget, non-fatal if sender closed
          try {
            sender.send('filesystem:scanProgress', { scanId, count: msg.count, path: msg.path });
          } catch { /* renderer may have navigated away */ }
        } else if (msg.type === 'done') {
          activeScans.delete(scanId);
          resolve({ success: true, data: results });
        }
      });

      worker.on('error', (err) => {
        activeScans.delete(scanId);
        resolve({ success: false, error: err.message });
      });

      worker.on('exit', (code) => {
        activeScans.delete(scanId);
        if (code !== 0) {
          resolve({ success: false, error: `Worker exited with code ${code}` });
        }
      });
    });
  });

  // Terminates an in-progress directory scan.
  ipcMain.handle('filesystem:cancelScan', wrapHandler((_event, scanId) => {
    const worker = activeScans.get(scanId);
    if (worker) {
      worker.terminate();
      activeScans.delete(scanId);
    }
    return null;
  }));

  ipcMain.handle('filesystem:readFile', wrapHandler((_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('Invalid path');
    return fs.readFileSync(filePath, 'utf8');
  }));

  ipcMain.handle('filesystem:exportPdf', wrapHandler(() => {
    throw new Error('filesystem:exportPdf not implemented — Phase 2');
  }));
}

module.exports = { registerFilesystemHandlers };
