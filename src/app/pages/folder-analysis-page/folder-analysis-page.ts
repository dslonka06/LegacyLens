import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription } from 'rxjs';
import { DependencyNode, KnowledgeState, RepositoryKnowledge } from '../../models/knowledge.model';
import { FolderNode, FileNode, RepositoryStructure } from '../../models/repository.model';
import { AnalysisResult } from '../../models/analysis-result.model';
import { NavigationContextService } from '../../services/navigation-context.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { AnalysisService } from '../../services/analysis.service';

const EXT_LANGUAGE_MAP: Record<string, string> = {
  cs: 'csharp', ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', py: 'python', json: 'json', xml: 'xml', csproj: 'xml', config: 'xml',
  md: 'markdown', txt: 'plaintext', sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
};

interface FolderTreeNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
  expanded: boolean;
  fileCount: number;
}

interface FileTreeNode {
  type: 'file';
  name: string;
  path: string;
  language: string;
  extension: string;
  depNode: DependencyNode | null;
}

type TreeNode = FolderTreeNode | FileTreeNode;

@Component({
  selector: 'app-folder-analysis-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  templateUrl: './folder-analysis-page.html',
  styleUrl: './folder-analysis-page.scss',
})
export class FolderAnalysisPage implements OnInit, OnDestroy {

  treeRoots: TreeNode[] = [];
  selectedNode: DependencyNode | null = null;
  hasWorkspace = false;
  hasStructure = false;
  knowledgeState: KnowledgeState = KnowledgeState.NotStarted;

  selectedFileContent = '';
  fileAnalysis: AnalysisResult | null = null;
  readonly SEGMENTS = [1, 2, 3, 4, 5];

  readonly monacoReadOnlyOptions = {
    theme: 'vs-dark', language: 'plaintext', readOnly: true, fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    lineNumbers: 'on' as const, minimap: { enabled: false }, scrollBeyondLastLine: false,
    wordWrap: 'off' as const, renderLineHighlight: 'all' as const, folding: true,
    automaticLayout: true, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 14, bottom: 14 }, glyphMargin: false, lineDecorationsWidth: 4, lineNumbersMinChars: 3,
  };

  readonly KnowledgeState = KnowledgeState;

  private knowledge: RepositoryKnowledge | null = null;
  private lastStructure: RepositoryStructure | null = null;
  private subs: Subscription[] = [];

  constructor(
    readonly nav: NavigationContextService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly analysisService: AnalysisService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.workspace.context$.subscribe(ctx => {
        this.hasWorkspace = ctx !== null;
        const structure = ctx?.profile.repositoryStructure ?? null;
        this.hasStructure = structure !== null;
        if (structure && structure !== this.lastStructure) {
          this.lastStructure = structure;
          this.buildTree(structure);
        }
      }),
      this.knowledgeService.state$.subscribe(s => { this.knowledgeState = s; }),
      this.knowledgeService.knowledge$.subscribe(k => {
        this.knowledge = k;
        if (k) this.resolveDepNodes(k);
        if (this.selectedNode && k) {
          this.selectedFileContent = this.resolveSourceContent(this.selectedNode.path ?? this.selectedNode.name);
          this.fileAnalysis = this.selectedFileContent ? this.analysisService.analyze(this.selectedFileContent) : null;
        }
      }),
      this.nav.selectedNode$.subscribe(node => {
        this.selectedNode = node;
        this.selectedFileContent = node ? this.resolveSourceContent(node.path ?? node.name) : '';
        this.fileAnalysis = node && this.selectedFileContent ? this.analysisService.analyze(this.selectedFileContent) : null;
      }),
    );

    const ctx = this.workspace.context;
    this.hasWorkspace = ctx !== null;
    const structure = ctx?.profile.repositoryStructure ?? null;
    this.hasStructure = structure !== null;
    if (structure) { this.lastStructure = structure; this.buildTree(structure); }

    this.knowledgeState = this.knowledgeService.state;
    this.knowledge = this.knowledgeService.knowledge;
    if (this.knowledge) this.resolveDepNodes(this.knowledge);

    this.selectedNode = this.nav.selectedNode;
    if (this.selectedNode) {
      this.selectedFileContent = this.resolveSourceContent(this.selectedNode.path ?? this.selectedNode.name);
      this.fileAnalysis = this.selectedFileContent ? this.analysisService.analyze(this.selectedFileContent) : null;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Tree ──────────────────────────────────────────────────────────────────

  private buildTree(structure: RepositoryStructure): void {
    this.treeRoots = this.folderToNodes(structure.root);
  }

  private folderToNodes(folder: FolderNode): TreeNode[] {
    return [
      ...folder.children.map(sub => this.folderNodeFrom(sub)),
      ...folder.files.map(f => this.fileNodeFrom(f)),
    ];
  }

  private folderNodeFrom(folder: FolderNode): FolderTreeNode {
    return { type: 'folder', name: folder.name, path: folder.path, children: this.folderToNodes(folder), expanded: false, fileCount: folder.totalFileCount };
  }

  private fileNodeFrom(file: FileNode): FileTreeNode {
    return { type: 'file', name: file.name, path: file.path, language: file.language, extension: file.extension, depNode: null };
  }

  private resolveDepNodes(knowledge: RepositoryKnowledge): void {
    if (!knowledge.dependencyGraph) return;
    this.walkTree(this.treeRoots, node => {
      if (node.type === 'file') {
        node.depNode = knowledge.dependencyGraph!.nodes.find(n => n.path === node.path || n.name === node.name) ?? null;
      }
    });
  }

  private walkTree(nodes: TreeNode[], fn: (n: TreeNode) => void): void {
    for (const node of nodes) {
      fn(node);
      if (node.type === 'folder') this.walkTree(node.children, fn);
    }
  }

  // ── Source resolution ─────────────────────────────────────────────────────

  private resolveSourceContent(nodePath: string): string {
    if (!this.knowledge?.sourceFiles?.length || !nodePath) return '';
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const target = norm(nodePath);
    const file = this.knowledge.sourceFiles.find(f => {
      const fp = norm(f.path);
      return fp === target || fp.endsWith('/' + target) || target.endsWith('/' + norm(f.path));
    });
    return file?.content ?? '';
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  selectFile(fileNode: FileTreeNode): void {
    if (!fileNode.depNode && this.knowledge?.dependencyGraph) {
      fileNode.depNode = this.knowledge.dependencyGraph.nodes.find(n =>
        n.path === fileNode.path || n.name === fileNode.name
      ) ?? null;
    }
    const node: DependencyNode = fileNode.depNode ?? { id: fileNode.path || fileNode.name, name: fileNode.name, path: fileNode.path, type: 'module' };
    this.nav.selectNode(node, 'file-tree');
  }

  toggleFolder(folder: FolderTreeNode): void {
    folder.expanded = !folder.expanded;
  }

  isSelected(fileNode: FileTreeNode): boolean {
    if (!this.selectedNode) return false;
    if (fileNode.depNode) return fileNode.depNode.id === this.selectedNode.id;
    return fileNode.path === this.selectedNode.path || fileNode.name === this.selectedNode.name;
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  startNewAnalysis(): void {
    this.router.navigate(['/']);
  }

  // ── Monaco ────────────────────────────────────────────────────────────────

  get monacoLanguage(): string {
    const ext = this.selectedNode?.path?.split('.').pop()?.toLowerCase() ?? '';
    return EXT_LANGUAGE_MAP[ext] ?? 'plaintext';
  }

  get monacoOptions(): object {
    return { ...this.monacoReadOnlyOptions, language: this.monacoLanguage };
  }

  get selectedFileLanguage(): string {
    return this.monacoLanguage === 'plaintext' ? '' : this.monacoLanguage;
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  get complexityFilled(): number {
    const map: Record<string, number> = { low: 1, medium: 3, high: 4, critical: 5 };
    return map[this.fileAnalysis?.complexity?.toLowerCase() ?? ''] ?? 0;
  }

  get maintainabilityFilled(): number {
    const map: Record<string, number> = { high: 5, medium: 3, low: 1 };
    return map[this.fileAnalysis?.maintainability?.toLowerCase() ?? ''] ?? 0;
  }

  complexitySegmentClass(index: number): string {
    if (index >= this.complexityFilled) return 'seg-empty';
    const filled = this.complexityFilled;
    if (filled <= 1) return 'seg-green';
    if (filled <= 2) return 'seg-yellow';
    if (filled <= 3) return 'seg-orange';
    return 'seg-red';
  }

  maintainabilitySegmentClass(index: number): string {
    if (index >= this.maintainabilityFilled) return 'seg-empty';
    const filled = this.maintainabilityFilled;
    if (filled >= 4) return 'seg-green';
    if (filled >= 3) return 'seg-yellow';
    if (filled >= 2) return 'seg-orange';
    return 'seg-red';
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  get workspaceName(): string {
    return this.workspace.context?.workspaceName ?? 'Folder';
  }

  get knowledgeStatusLabel(): string {
    switch (this.knowledgeState) {
      case KnowledgeState.ReadingFiles:          return 'Reading files...';
      case KnowledgeState.BuildingDependencies:  return 'Building dependency graph...';
      case KnowledgeState.DetectingArchitecture: return 'Detecting architecture...';
      case KnowledgeState.Complete:              return 'Folder knowledge ready';
      case KnowledgeState.Failed:                return 'Knowledge build failed';
      default:                                   return '';
    }
  }

  get knowledgeStatusClass(): string {
    switch (this.knowledgeState) {
      case KnowledgeState.Complete: return 'ks-ready';
      case KnowledgeState.Failed:   return 'ks-failed';
      default:                      return 'ks-building';
    }
  }

  get isKnowledgeBuilding(): boolean {
    return this.knowledgeState !== KnowledgeState.Complete
      && this.knowledgeState !== KnowledgeState.NotStarted
      && this.knowledgeState !== KnowledgeState.Failed;
  }

  get nodePurpose(): string {
    return this.selectedNode ? `${this.selectedNode.name} — a file in this folder.` : '';
  }

  fileIcon(ext: string): string {
    const map: Record<string, string> = {
      ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡', cs: '🟣', html: '🟠',
      css: '🔵', scss: '🔵', json: '📋', xml: '📋', sql: '🗄️', md: '📝',
    };
    return map[ext?.toLowerCase()] ?? '📄';
  }

  get breadcrumbs() { return this.nav.breadcrumbs; }
  get canGoBack()   { return this.nav.canGoBack; }
  get canGoForward(){ return this.nav.canGoForward; }
  back(): void    { this.nav.back(); }
  forward(): void { this.nav.forward(); }
}
