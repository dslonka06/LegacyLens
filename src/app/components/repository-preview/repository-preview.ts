import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceProfile } from '../../models/workspace.model';
import { FolderNode, ProjectNode, RepositoryStructure } from '../../models/repository.model';

interface TreeRow {
  kind: 'folder' | 'file';
  name: string;
  depth: number;
  fileCount?: number;   // folders only
  extension?: string;   // files only
  language?: string;    // files only
}

@Component({
  selector: 'app-repository-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repository-preview.html',
  styleUrl: './repository-preview.scss',
})
export class RepositoryPreview implements OnChanges {

  @Input() profile: WorkspaceProfile | null = null;

  treeRows: TreeRow[] = [];
  treeExpanded = true;
  projectsExpanded = true;

  // Max folders shown in collapsed state before "show more" is needed
  private readonly TREE_PREVIEW_DEPTH = 3;

  get structure(): RepositoryStructure | null {
    return this.profile?.repositoryStructure ?? null;
  }

  get projects(): ProjectNode[] {
    return this.structure?.projects ?? [];
  }

  get hasContent(): boolean {
    return this.treeRows.length > 0 || this.projects.length > 0;
  }

  get totalFiles(): number {
    return this.structure?.totalFileCount ?? 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile']) {
      this.rebuildTree();
    }
  }

  toggleTree(): void { this.treeExpanded = !this.treeExpanded; }
  toggleProjects(): void { this.projectsExpanded = !this.projectsExpanded; }

  projectTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      AngularApplication:  'Angular App',
      ReactApplication:    'React App',
      VueApplication:      'Vue App',
      AspNetApi:           'ASP.NET API',
      AspNetMvc:           'ASP.NET MVC',
      ClassLibrary:        'Class Library',
      SharedLibrary:       'Shared Library',
      DatabaseProject:     'Database Project',
      NodeApplication:     'Node App',
      PythonApplication:   'Python App',
      RustApplication:     'Rust App',
      GoApplication:       'Go App',
      JavaApplication:     'Java App',
      Unknown:             'Project',
    };
    return labels[type] ?? type;
  }

  indentStyle(depth: number): Record<string, string> {
    return { 'padding-left': `${depth * 14 + 8}px` };
  }

  private rebuildTree(): void {
    if (!this.structure) {
      this.treeRows = [];
      return;
    }
    const rows: TreeRow[] = [];
    this.flattenFolder(this.structure.root, 0, rows);
    this.treeRows = rows;
  }

  private flattenFolder(folder: FolderNode, depth: number, rows: TreeRow[]): void {
    // Skip the synthetic root node itself — show its children as top-level
    if (depth > 0) {
      rows.push({
        kind: 'folder',
        name: folder.name,
        depth: depth - 1,
        fileCount: folder.totalFileCount,
      });
    }

    // Limit tree depth in the preview to avoid overwhelming the panel
    if (depth >= this.TREE_PREVIEW_DEPTH) {
      return;
    }

    // Sort: folders first, then files, both alphabetically
    for (const child of [...folder.children].sort((a, b) => a.name.localeCompare(b.name))) {
      this.flattenFolder(child, depth + 1, rows);
    }

    if (depth === 0) {
      // Root-level files shown after all folders
      for (const file of [...folder.files].sort((a, b) => a.name.localeCompare(b.name))) {
        rows.push({
          kind: 'file',
          name: file.name,
          depth: 0,
          extension: file.extension,
          language: file.language,
        });
      }
    }
  }
}
