import { Component, NgZone, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CodeEditor } from '../../components/code-editor/code-editor';
import { WorkspacePanel } from '../../components/workspace-panel/workspace-panel';
import { WorkspaceSwitcherModal } from '../../components/workspace-switcher-modal/workspace-switcher-modal';
import { AnalysisSession } from '../../models/analysis-session.model';
import { WorkspaceProfile } from '../../models/workspace.model';
import { WorkspaceContext } from '../../models/workspace-context.model';
import { FolderNode } from '../../models/repository.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { SecurityAnalysisService } from '../../services/security-analysis.service';
import { SystemUnderstandingService } from '../../services/system-understanding.service';
import { RecommendationAnalysisService } from '../../services/recommendation-analysis.service';
import { LearningPathAnalysisService } from '../../services/learning-path-analysis.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { AiKnowledgeService } from '../../services/ai-knowledge.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';

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
  selector: 'app-repository-analysis-page',
  standalone: true,
  imports: [CommonModule, CodeEditor, WorkspacePanel, WorkspaceSwitcherModal, ResizeDividerComponent],
  templateUrl: './repository-analysis-page.html',
  styleUrl: './repository-analysis-page.scss',
})
export class RepositoryAnalysisPage implements OnInit, OnDestroy {

  @ViewChild(CodeEditor) private editor!: CodeEditor;

  session: AnalysisSession | null = null;
  workspaceProfile: WorkspaceProfile | null = null;
  workspaceContext: WorkspaceContext | null = null;

  restoredFileName: string | null = null;
  restoredSourceCode: string | null = null;

  treeRoots: TreeItem[] = [];
  selectedFilePath: string | null = null;
  panelWidths = [220, 460];

  showSwitcher = false;
  switcherLimitReached = false;

  private uploadedFiles: File[] = [];
  private contextSub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  private securitySub: Subscription | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly manager: WorkspaceManagerService,
    private readonly securityService: SecurityAnalysisService,
    private readonly understandingService: SystemUnderstandingService,
    private readonly recService: RecommendationAnalysisService,
    private readonly learningPathService: LearningPathAnalysisService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly aiKnowledge: AiKnowledgeService,
    private readonly layoutService: PanelLayoutService,
    private readonly zone: NgZone,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('repository-analysis') ?? [220, 460];
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

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());

    // Generate security and system understanding once knowledge pipeline completes
    this.securitySub = this.knowledgeService.knowledge$.subscribe(knowledge => {
      const id = this.manager.activeId;
      if (knowledge && id) {
        const security = this.securityService.analyzeKnowledge(knowledge, this.session);
        this.manager.setSecurityAnalysis(id, security);
        const understanding = this.understandingService.analyzeKnowledge(knowledge, this.session);
        this.manager.setSystemUnderstanding(id, understanding);
        const recs = this.recService.analyzeKnowledge(knowledge, this.session);
        this.manager.setRecommendationAnalysis(id, recs);
        const ws = this.manager.getById(id);
        if (ws?.systemUnderstanding) {
          const lp = this.learningPathService.analyzeKnowledge(knowledge, this.session, ws.systemUnderstanding, 'repository');
          this.manager.setLearningPathAnalysis(id, lp);
        }

        // Trigger AI explanation once per knowledge load — skip if already generated
        const ctx = this.workspaceContext;
        if (ctx && !this.manager.getById(id)?.aiExplanation) {
          this.aiKnowledge.explainRepository(ctx, knowledge).subscribe({
            next: content => this.manager.setAiExplanation(id, {
              type: 'repository',
              title: 'Repository Explanation',
              content,
              generatedAt: new Date().toISOString(),
            }),
            error: () => { /* AI unavailable — explanation stays null, page degrades gracefully */ },
          });
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.contextSub?.unsubscribe();
    this.limitSub?.unsubscribe();
    this.securitySub?.unsubscribe();
  }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('repository-analysis', this.panelWidths);
  }

  // ── CodeEditor event handlers ─────────────────────────────────────────────

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.restoredFileName = session.fileName;
    this.restoredSourceCode = session.sourceCode;
    this.currentAnalysis.setSession(session);
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
      this.zone.run(() => {
        this.editor.loadFile(file.name, reader.result as string);
      });
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

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
  }

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  get hasTree(): boolean {
    return this.treeRoots.length > 0;
  }

  get hasWorkspace(): boolean {
    return this.workspaceProfile !== null;
  }

  get repoName(): string {
    return this.workspaceContext?.workspaceName ?? 'Repository';
  }

  get repoTypeLabel(): string {
    const structure = this.workspaceProfile?.repositoryStructure;
    if (!structure) return 'Multi-File';
    const types = structure.projects.map(p => p.type);
    const unique = [...new Set(types)];
    if (unique.length === 0) return 'Repository';
    if (unique.length === 1) return unique[0];
    return 'Mixed';
  }

  get primaryLanguage(): string {
    return this.workspaceProfile?.languages[0] ?? '—';
  }

  get frameworks(): string {
    if (!this.workspaceProfile) return '—';
    const detected = this.workspaceProfile.detectedTechnologies
      ?.filter(t => t.category === 'Framework' || t.category === 'Runtime')
      .map(t => t.technology);
    if (detected && detected.length > 0) return detected.join(', ');
    return this.workspaceProfile.technologies.slice(0, 3).join(', ') || '—';
  }

  get projectCount(): number {
    return this.workspaceProfile?.repositoryStructure?.projects.length ?? 0;
  }

  get fileCount(): number {
    return this.workspaceProfile?.totalFiles ?? 0;
  }

  get languagesDetected(): string {
    const langs = this.workspaceProfile?.languages ?? [];
    return langs.length > 0 ? langs.join(', ') : '—';
  }

  get estimatedSize(): string {
    const files = this.workspaceProfile?.files ?? [];
    const bytes = files.reduce((sum, f) => sum + f.size, 0);
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
