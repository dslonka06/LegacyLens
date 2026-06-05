import { Injectable } from '@angular/core';
import { FileMetadata } from '../models/workspace.model';
import { ProjectNode, ProjectType } from '../models/repository.model';

interface ProjectRule {
  // Returns the anchoring project file path if this rule matches
  match: (files: FileMetadata[]) => FileMetadata | undefined;
  type: ProjectType;
  framework: string;
  language: string;
  // Derive project name from the matching file — defaults to parent folder name
  nameFrom?: (file: FileMetadata) => string;
}

const PROJECT_RULES: ProjectRule[] = [
  // Angular must come before the generic Node rule — more specific
  {
    type: 'AngularApplication',
    framework: 'Angular',
    language: 'TypeScript',
    match: files => files.find(f => f.name.toLowerCase() === 'angular.json'),
  },
  // Next.js before generic React
  {
    type: 'ReactApplication',
    framework: 'Next.js',
    language: 'TypeScript',
    match: files => files.find(f =>
      ['next.config.js', 'next.config.ts', 'next.config.mjs'].includes(f.name.toLowerCase())
    ),
  },
  // React — jsx/tsx without next.config
  {
    type: 'ReactApplication',
    framework: 'React',
    language: 'TypeScript',
    match: files => {
      const hasNextConfig = files.some(f =>
        ['next.config.js', 'next.config.ts'].includes(f.name.toLowerCase())
      );
      if (hasNextConfig) return undefined;
      return files.find(f => ['jsx', 'tsx'].includes(f.extension.toLowerCase()));
    },
  },
  // Vue
  {
    type: 'VueApplication',
    framework: 'Vue',
    language: 'TypeScript',
    match: files => files.find(f => f.extension.toLowerCase() === 'vue'),
  },
  // ASP.NET API — Program.cs + .csproj
  {
    type: 'AspNetApi',
    framework: 'ASP.NET',
    language: 'C#',
    match: files => {
      const hasCsproj = files.some(f => f.extension.toLowerCase() === 'csproj');
      if (!hasCsproj) return undefined;
      return files.find(f => f.name.toLowerCase() === 'program.cs');
    },
    nameFrom: file => parentFolderName(file.path) || 'ASP.NET API',
  },
  // Generic .NET class/shared library — .csproj without Program.cs
  {
    type: 'ClassLibrary',
    framework: '.NET',
    language: 'C#',
    match: files => {
      const hasProgram = files.some(f => f.name.toLowerCase() === 'program.cs');
      if (hasProgram) return undefined;
      return files.find(f => f.extension.toLowerCase() === 'csproj');
    },
    nameFrom: file => file.name.replace(/\.csproj$/i, '') || parentFolderName(file.path) || 'Class Library',
  },
  // Database project
  {
    type: 'DatabaseProject',
    framework: 'SQL',
    language: 'SQL',
    match: files => files.find(f => f.extension.toLowerCase() === 'sqlproj'),
  },
  // Generic Node (no framework detected above)
  {
    type: 'NodeApplication',
    framework: 'Node.js',
    language: 'JavaScript',
    match: files => {
      const hasAngular = files.some(f => f.name.toLowerCase() === 'angular.json');
      const hasNext = files.some(f =>
        ['next.config.js', 'next.config.ts'].includes(f.name.toLowerCase())
      );
      if (hasAngular || hasNext) return undefined;
      return files.find(f => f.name.toLowerCase() === 'package.json');
    },
  },
  // Python
  {
    type: 'PythonApplication',
    framework: 'Python',
    language: 'Python',
    match: files => files.find(f =>
      ['pyproject.toml', 'setup.py', 'requirements.txt'].includes(f.name.toLowerCase())
    ),
  },
  // Rust
  {
    type: 'RustApplication',
    framework: 'Rust',
    language: 'Rust',
    match: files => files.find(f => f.name.toLowerCase() === 'cargo.toml'),
  },
  // Go
  {
    type: 'GoApplication',
    framework: 'Go',
    language: 'Go',
    match: files => files.find(f => f.name.toLowerCase() === 'go.mod'),
  },
  // Java / Spring
  {
    type: 'JavaApplication',
    framework: 'Java',
    language: 'Java',
    match: files => files.find(f =>
      ['pom.xml', 'build.gradle', 'build.gradle.kts'].includes(f.name.toLowerCase())
    ),
  },
];

function parentFolderName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

@Injectable({ providedIn: 'root' })
export class ProjectDiscoveryService {

  // Groups files by project root directory, then applies rules within each group.
  // A single flat upload (no webkitRelativePath) is treated as one group at root.
  discoverProjects(files: FileMetadata[]): ProjectNode[] {
    const groups = this.groupByProjectRoot(files);
    const projects: ProjectNode[] = [];

    for (const [rootPath, groupFiles] of groups) {
      const node = this.detectProject(groupFiles, rootPath);
      if (node) projects.push(node);
    }

    return projects;
  }

  private groupByProjectRoot(files: FileMetadata[]): Map<string, FileMetadata[]> {
    // Project root = the directory containing a known project file.
    // Files with no project anchor go into the '' (root) group.
    const projectFilePaths = new Set<string>();
    const projectAnchorNames = new Set([
      'package.json', 'angular.json', 'cargo.toml', 'go.mod', 'pom.xml',
      'build.gradle', 'build.gradle.kts', 'pyproject.toml', 'setup.py',
      'requirements.txt', 'gemfile', 'composer.json',
    ]);
    const projectAnchorExts = new Set(['csproj', 'fsproj', 'vbproj', 'sqlproj']);

    for (const f of files) {
      if (
        projectAnchorNames.has(f.name.toLowerCase()) ||
        projectAnchorExts.has(f.extension.toLowerCase())
      ) {
        projectFilePaths.add(this.parentDir(f.path));
      }
    }

    // If no project anchors exist, all files belong to a single unnamed group
    if (projectFilePaths.size === 0) {
      return new Map([['', files]]);
    }

    // Assign each file to the deepest matching project root
    const groups = new Map<string, FileMetadata[]>();
    for (const f of files) {
      const root = this.findDeepestRoot(f.path, projectFilePaths);
      const key = root ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }

    return groups;
  }

  private detectProject(files: FileMetadata[], rootPath: string): ProjectNode | null {
    for (const rule of PROJECT_RULES) {
      const anchorFile = rule.match(files);
      if (!anchorFile) continue;

      const name = rule.nameFrom
        ? rule.nameFrom(anchorFile)
        : parentFolderName(anchorFile.path) || anchorFile.name;

      return {
        name: name || 'Project',
        path: rootPath,
        type: rule.type,
        framework: rule.framework,
        language: rule.language,
        projectFile: anchorFile.path,
      };
    }
    return null;
  }

  private parentDir(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.substring(0, idx) : '';
  }

  private findDeepestRoot(filePath: string, roots: Set<string>): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    // Walk from longest (deepest) to shortest to find the most-specific root
    const sorted = Array.from(roots).sort((a, b) => b.length - a.length);
    for (const root of sorted) {
      if (normalized.startsWith(root ? root + '/' : '')) return root;
    }
    return null;
  }
}
