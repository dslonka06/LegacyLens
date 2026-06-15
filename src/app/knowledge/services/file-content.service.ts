import { Injectable } from '@angular/core';
import { SourceFile } from '../models/knowledge.model';

// Maximum file size to read — avoids stalling on large generated files (e.g. minified JS)
const MAX_FILE_SIZE_BYTES = 500_000; // 500 KB

// Extensions treated as source code worth reading
const READABLE_EXTENSIONS = new Set([
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

// Path segments that signal generated or non-source content
const IGNORED_PATH_SEGMENTS = new Set([
  'node_modules', '.git', 'bin', 'obj', 'dist', '.angular',
  'coverage', '.nyc_output', 'out', 'build', 'publish',
  '__pycache__', '.venv', 'venv', '.tox', 'target',
]);

@Injectable({ providedIn: 'root' })
export class FileContentService {

  // Reads all readable files concurrently and returns their contents.
  // Files that fail to read are silently skipped — a single unreadable file
  // must not abort the entire knowledge build.
  async readFiles(files: File[]): Promise<SourceFile[]> {
    const readable = files.filter(f => this.isReadable(f));
    const results = await Promise.allSettled(readable.map(f => this.readOne(f)));

    return results
      .filter((r): r is PromiseFulfilledResult<SourceFile> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  private isReadable(file: File): boolean {
    if (file.size > MAX_FILE_SIZE_BYTES) return false;

    const path = (file as any).webkitRelativePath || file.name;
    const segments = path.replace(/\\/g, '/').split('/');
    if (segments.some((s: string) => IGNORED_PATH_SEGMENTS.has(s))) return false;

    const ext = this.extension(file.name);
    return READABLE_EXTENSIONS.has(ext);
  }

  private readOne(file: File): Promise<SourceFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        resolve({
          path: (file as any).webkitRelativePath || file.name,
          extension: this.extension(file.name),
          content,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  }

  private extension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }
}
