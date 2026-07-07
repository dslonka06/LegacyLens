const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'bin', 'obj', 'dist', '.angular',
  'coverage', '.nyc_output', '.next', 'out', 'build', 'publish',
  '__pycache__', '.venv', 'venv', '.tox', 'target',
  '.vscode', '.idea', 'packages', 'vendor',
]);

// Extensions where the AI pipeline actually needs file content.
// Mirrors FileContentService.READABLE_EXTENSIONS in Angular.
const SOURCE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs',
  'cs', 'fs', 'vb',
  'java', 'kt', 'scala',
  'py', 'rb', 'php', 'go', 'rs', 'swift', 'cpp', 'c', 'h', 'hpp',
  'html', 'htm', 'vue', 'svelte',
  'css', 'scss', 'less',
  'sql',
  'json', 'xml', 'yaml', 'yml', 'toml',
  'md', 'txt', 'sh', 'bash', 'ps1',
]);

// Always skip these — binaries, build artifacts, fonts, media
const SKIP_EXTENSIONS = new Set([
  '.exe', '.dll', '.pdb', '.so', '.dylib', '.o', '.obj',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp4', '.mp3', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.docx', '.xlsx', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot',
  '.map',
]);

const MAX_FILE_SIZE = 500 * 1024; // 500 KB — matches Angular FileContentService

function walkDirectory(dirPath, rootPath, results) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkDirectory(fullPath, rootPath, results);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;

    // Strip the leading dot to compare against SOURCE_EXTENSIONS (e.g. ".ts" → "ts")
    const extKey = ext.startsWith('.') ? ext.slice(1) : ext;
    const isSource = SOURCE_EXTENSIONS.has(extKey);

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (!isSource || stat.size > MAX_FILE_SIZE) {
      // Metadata-only entry — still tells Angular the file exists for workspace profiling
      results.push({
        name: entry.name,
        relativePath,
        content: null,
        size: stat.size,
      });
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    results.push({
      name: entry.name,
      relativePath,
      content,
      size: stat.size,
    });
  }
}

function registerFilesystemHandlers() {
  ipcMain.handle('filesystem:openDialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(options ?? {});
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('filesystem:readDirectory', async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== 'string') return [];
    const results = [];
    walkDirectory(dirPath, dirPath, results);
    return results;
  });

  ipcMain.handle('filesystem:readFile', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('Invalid path');
    return fs.readFileSync(filePath, 'utf8');
  });

  ipcMain.handle('filesystem:exportPdf', async (_event, _filePath, _content) => {
    throw new Error('filesystem:exportPdf not implemented — Phase 2');
  });
}

module.exports = { registerFilesystemHandlers };
