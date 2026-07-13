import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

interface TreeFolder {
  node: FolderNode;
  depth: number;
  expanded: boolean;
  visible: boolean;
}

interface TreeFile {
  node: FileNode;
  folderPath: string;
  depth: number;
  visible: boolean;
}

type TreeRow = ({ kind: 'folder' } & TreeFolder) | ({ kind: 'file' } & TreeFile);

@Component({
  selector: 'app-file-tree-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-tree-panel.html',
  styleUrl: './file-tree-panel.scss',
})
export class FileTreePanel implements OnChanges {
  @Input() folderTree: FolderNode | undefined | null = null;
  @Input() highlightPath: string | null = null;

  @Output() fileSelected = new EventEmitter<FileNode>();

  searchQuery = '';
  selectedPath: string | null = null;

  rows: TreeRow[] = [];

  private expandedPaths = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['folderTree']) {
      this.expandedPaths.clear();
      if (this.folderTree) {
        // Expand root and its immediate children by default
        this.expandedPaths.add(this.folderTree.path);
        this.folderTree.children.forEach((c) => this.expandedPaths.add(c.path));
      }
      this.rebuildRows();
    }
    if (changes['highlightPath'] && this.highlightPath) {
      this.selectedPath = this.highlightPath;
      this.expandToPath(this.highlightPath);
      this.rebuildRows();
    }
  }

  get hasTree(): boolean {
    return !!this.folderTree;
  }

  get filteredRows(): TreeRow[] {
    if (!this.searchQuery.trim()) return this.rows.filter((r) => r.visible);
    const q = this.searchQuery.toLowerCase();
    return this.rows.filter((r) => r.node.name.toLowerCase().includes(q));
  }

  toggleFolder(path: string): void {
    if (this.expandedPaths.has(path)) this.expandedPaths.delete(path);
    else this.expandedPaths.add(path);
    this.rebuildRows();
  }

  selectFile(file: FileNode): void {
    this.selectedPath = file.path;
    this.fileSelected.emit(file);
  }

  isExpanded(path: string): boolean {
    return this.expandedPaths.has(path);
  }

  trackRow(_: number, row: TreeRow): string {
    return row.node.path;
  }

  private expandToPath(targetPath: string): void {
    if (!this.folderTree) return;
    this.expandAncestors(this.folderTree, targetPath);
  }

  private expandAncestors(node: FolderNode, target: string): boolean {
    const inFiles = node.files.some((f) => f.path === target || target.startsWith(f.path));
    const inChildren = node.children.some(
      (c) => target.startsWith(c.path) || this.expandAncestors(c, target),
    );
    if (inFiles || inChildren) {
      this.expandedPaths.add(node.path);
      return true;
    }
    return false;
  }

  private rebuildRows(): void {
    if (!this.folderTree) {
      this.rows = [];
      return;
    }
    const rows: TreeRow[] = [];
    this.walkFolder(this.folderTree, 0, rows);
    this.rows = rows;
  }

  private walkFolder(node: FolderNode, depth: number, rows: TreeRow[]): void {
    const isRoot = depth === 0;
    const expanded = this.expandedPaths.has(node.path);

    if (!isRoot) {
      rows.push({ kind: 'folder', node, depth, expanded, visible: true });
    }

    if (isRoot || expanded) {
      for (const child of node.children) {
        this.walkFolder(child, depth + (isRoot ? 0 : 1), rows);
      }
      for (const file of node.files) {
        rows.push({
          kind: 'file',
          node: file,
          folderPath: node.path,
          depth: depth + (isRoot ? 0 : 1),
          visible: true,
        });
      }
    }
  }
}
