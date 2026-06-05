import { Injectable } from '@angular/core';
import { FileMetadata } from '../models/workspace.model';

const EXT_TO_LANGUAGE: Record<string, string> = {
  cs:      'C#',
  ts:      'TypeScript',
  tsx:     'TypeScript',
  js:      'JavaScript',
  jsx:     'JavaScript',
  html:    'HTML',
  htm:     'HTML',
  css:     'CSS',
  scss:    'SCSS',
  less:    'Less',
  sql:     'SQL',
  py:      'Python',
  json:    'JSON',
  xml:     'XML',
  md:      'Markdown',
  txt:     'Plain Text',
  sh:      'Shell',
  bash:    'Shell',
  yml:     'YAML',
  yaml:    'YAML',
  rs:      'Rust',
  go:      'Go',
  java:    'Java',
  kt:      'Kotlin',
  swift:   'Swift',
  rb:      'Ruby',
  php:     'PHP',
  cpp:     'C++',
  c:       'C',
  h:       'C/C++ Header',
  hpp:     'C++ Header',
};

@Injectable({ providedIn: 'root' })
export class FileInventoryService {

  buildMetadata(files: File[]): FileMetadata[] {
    return files.map(file => {
      const name = file.name;
      const path = (file as any).webkitRelativePath || name;
      const extension = this.extractExtension(name);
      const language = EXT_TO_LANGUAGE[extension] ?? 'Unknown';
      return { name, path, extension, language, size: file.size };
    });
  }

  private extractExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }
}
