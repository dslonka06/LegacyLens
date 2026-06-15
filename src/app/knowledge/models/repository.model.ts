// Metadata-only — no file contents stored here.
// Contents belong to the parsing pipeline (Stage 3+).

export interface FileNode {
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
}

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  files: FileNode[];
  // Total descendant file count — cached to avoid repeated tree walks
  totalFileCount: number;
}

export type ProjectType =
  | 'AngularApplication'
  | 'ReactApplication'
  | 'VueApplication'
  | 'AspNetApi'
  | 'AspNetMvc'
  | 'ClassLibrary'
  | 'SharedLibrary'
  | 'DatabaseProject'
  | 'NodeApplication'
  | 'PythonApplication'
  | 'RustApplication'
  | 'GoApplication'
  | 'JavaApplication'
  | 'Unknown';

export interface ProjectNode {
  name: string;
  path: string;
  type: ProjectType;
  framework: string;
  language: string;
  // The project file that anchored discovery (e.g. package.json, *.csproj)
  projectFile: string;
}

export interface RepositoryStructure {
  // Normalized root folder tree — metadata only
  root: FolderNode;
  // Flat list of all discovered projects
  projects: ProjectNode[];
  // Total depth of the folder hierarchy
  maxDepth: number;
  // Total file count across the whole structure
  totalFileCount: number;
}
