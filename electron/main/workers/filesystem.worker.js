const { workerData, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'bin', 'obj', 'dist', '.angular',
  'coverage', '.nyc_output', '.next', 'out', 'build', 'publish',
  '__pycache__', '.venv', 'venv', '.tox', 'target',
  '.vscode', '.idea', 'packages', 'vendor',
]);

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

const SKIP_EXTENSIONS = new Set([
  '.exe', '.dll', '.pdb', '.so', '.dylib', '.o', '.obj',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp4', '.mp3', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.docx', '.xlsx', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot',
  '.map',
]);

const MAX_FILE_SIZE = 500 * 1024;

// Batch progress updates — emit every N files to avoid flooding IPC
const PROGRESS_BATCH = 50;

let fileCount = 0;

function walkDirectory(dirPath, rootPath) {
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
      walkDirectory(fullPath, rootPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;

    const extKey = ext.startsWith('.') ? ext.slice(1) : ext;
    const isSource = SOURCE_EXTENSIONS.has(extKey);

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
    const modifiedAt = stat.mtime.toISOString();

    let result;
    if (!isSource || stat.size > MAX_FILE_SIZE) {
      result = { name: entry.name, relativePath, content: null, size: stat.size, modifiedAt };
    } else {
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      result = { name: entry.name, relativePath, content, size: stat.size, modifiedAt };
    }

    parentPort.postMessage({ type: 'file', file: result });

    fileCount++;
    if (fileCount % PROGRESS_BATCH === 0) {
      parentPort.postMessage({ type: 'progress', count: fileCount, path: relativePath });
    }
  }
}

const { dirPath } = workerData;
walkDirectory(dirPath, dirPath);
parentPort.postMessage({ type: 'done', total: fileCount });
