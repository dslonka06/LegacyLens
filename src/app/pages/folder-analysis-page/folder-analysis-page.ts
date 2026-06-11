import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CodeEditor } from '../../components/code-editor/code-editor';
import { AnalysisPanel } from '../../components/analysis-panel/analysis-panel';
import { WorkspaceSummary } from '../../components/workspace-summary/workspace-summary';
import { RepositoryCallout } from '../../components/repository-callout/repository-callout';
import { AnalysisSession } from '../../models/analysis-session.model';
import { WorkspaceProfile } from '../../models/workspace.model';
import { WorkspaceContext } from '../../models/workspace-context.model';
import { FolderNode } from '../../models/repository.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { HistoryService } from '../../services/history.service';

interface TreeFolder {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeItem[];
  expanded: boolean;
  fileCount: number;
}

interface TreeFile {
  kind: 'file';
  name: string;
  path: string;
  extension: string;
}

type TreeItem = TreeFolder | TreeFile;

const EXT_ICON: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡', cs: '🟣', html: '🟠',
  css: '🔵', scss: '🔵', json: '📋', xml: '📋', sql: '🗄️', md: '📝',
  py: '🐍', sh: '📜', bash: '📜', yml: '⚙️', yaml: '⚙️',
};

@Component({
  selector: 'app-folder-analysis-page',
  standalone: true,
  imports: [CommonModule, CodeEditor, AnalysisPanel, WorkspaceSummary, RepositoryCallout],
  templateUrl: './folder-analysis-page.html',
  styleUrl: './folder-analysis-page.scss',
})
export class FolderAnalysisPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  workspaceProfile: WorkspaceProfile | null = null;
  workspaceContext: WorkspaceContext | null = null;

  restoredFileName: string | null = null;
  restoredSourceCode: string | null = null;

  treeRoots: TreeItem[] = [];
  selectedFilePath: string | null = null;

  // Held so tree-node clicks can read file content
  private uploadedFiles: File[] = [];
  private contextSub: Subscription | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly history: HistoryService,
  ) {}

  ngOnInit(): void {
    const existing = this.currentAnalysis.getSession();
    if (existing) {
      this.session = existing;
      this.restoredFileName = existing.fileName;
      this.restoredSourceCode = existing.sourceCode;
      this.workspaceProfile = existing.workspaceContext ?? null;
    }

    this.workspaceContext = this.currentWorkspace.context;
    if (this.workspaceContext) {
      this.workspaceProfile = this.workspaceContext.profile;
      this.buildTree(this.workspaceProfile);
    }

    this.contextSub = this.currentWorkspace.context$.subscribe(ctx => {
      this.workspaceContext = ctx;
    });
  }

  ngOnDestroy(): void {
    this.contextSub?.unsubscribe();
  }

  // ── CodeEditor event handlers ─────────────────────────────────────────────

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.restoredFileName = session.fileName;
    this.restoredSourceCode = session.sourceCode;
    this.currentAnalysis.setSession(session);
    this.history.addSession(session);
  }

  onWorkspaceReady(profile: WorkspaceProfile | null): void {
    this.workspaceProfile = profile;
    if (profile) {
      this.buildTree(profile);
    } else {
      this.treeRoots = [];
      this.selectedFilePath = null;
    }
  }

  onFilesUploaded(files: File[]): void {
    this.uploadedFiles = files;
  }

  // ── Tree ──────────────────────────────────────────────────────────────────

  private buildTree(profile: WorkspaceProfile): void {
    const structure = profile.repositoryStructure;
    if (!structure) {
      // Flat file list fallback — no folder structure available
      this.treeRoots = profile.files.map(f => ({
        kind: 'file' as const,
        name: f.name,
        path: f.path,
        extension: f.extension,
      }));
      return;
    }
    this.treeRoots = this.folderToItems(structure.root);
  }

  private folderToItems(folder: FolderNode): TreeItem[] {
    const subfolders: TreeFolder[] = folder.children.map(child => ({
      kind: 'folder' as const,
      name: child.name,
      path: child.path,
      children: this.folderToItems(child),
      expanded: false,
      fileCount: child.totalFileCount,
    }));
    const files: TreeFile[] = folder.files.map(f => ({
      kind: 'file' as const,
      name: f.name,
      path: f.path,
      extension: f.extension,
    }));
    return [...subfolders, ...files];
  }

  toggleFolder(folder: TreeFolder): void {
    folder.expanded = !folder.expanded;
  }

  selectFile(file: TreeFile): void {
    this.selectedFilePath = file.path;
    const raw = this.findRawFile(file);
    if (!raw) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.restoredFileName = file.name;
      this.restoredSourceCode = reader.result as string;
    };
    reader.readAsText(raw);
  }

  isFileSelected(file: TreeFile): boolean {
    return this.selectedFilePath === file.path;
  }

  fileIcon(ext: string): string {
    return EXT_ICON[ext?.toLowerCase()] ?? '📄';
  }

  private findRawFile(file: TreeFile): File | undefined {
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const target = norm(file.path);
    return this.uploadedFiles.find(f => {
      const rel = norm((f as any).webkitRelativePath || f.name);
      return rel === target || rel.endsWith('/' + target) || target.endsWith('/' + norm(f.name));
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  get hasTree(): boolean {
    return this.treeRoots.length > 0;
  }

  get showWorkspaceSummary(): boolean {
    return this.workspaceProfile !== null;
  }

  get showRepositoryCallout(): boolean {
    if (!this.workspaceProfile) return false;
    const t = this.workspaceProfile.workspaceType;
    return t === 'Project' || t === 'Repository';
  }
}
