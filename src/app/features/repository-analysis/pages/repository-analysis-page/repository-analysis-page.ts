import { Component, NgZone, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import { WorkspacePanel } from '@app/workspace/components/workspace-panel/workspace-panel';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import { TargetValidationService, ValidationResult, AnalysisTarget } from '@app/core/services/target-validation.service';
import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceProfile } from '@app/workspace/models/workspace.model';
import { WorkspaceContext } from '@app/workspace/models/workspace-context.model';
import { FolderNode } from '@app/knowledge/models/repository.model';
import { CurrentAnalysisService } from '@app/workspace/services/current-analysis.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { PendingRepositoryService } from '@app/core/services/pending-repository.service';
import { ElectronService } from '@app/core/services/electron.service';
import { FileInventoryService } from '@app/knowledge/services/file-inventory.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { SecurityAnalysisService } from '@app/analysis/services/security-analysis.service';
import { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';
import { SystemUnderstandingService } from '@app/analysis/services/system-understanding.service';
import { RecommendationAnalysisService } from '@app/analysis/services/recommendation-analysis.service';
import { LearningPathAnalysisService } from '@app/analysis/services/learning-path-analysis.service';
import { RepositoryKnowledgeService } from '@app/knowledge/services/repository-knowledge.service';
import { AiKnowledgeService } from '../../../../ai/services/ai-knowledge.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import type { ExplanationResult } from '@app/analysis/models/ai-explanation-context.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import type { ElectronAnalysis, ElectronDirectoryEntry } from '../../../../electron';
import { hashContent } from '@app/core/utils/hash';

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
  imports: [CommonModule, CodeEditor, WorkspacePanel, WorkspaceSwitcherModal, ResizeDividerComponent, ValidationDialog],
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
  summaryExpanded = false;
  risksExpanded = false;
  modernizationExpanded = false;
  historyExpanded = false;

  analysisHistory: ElectronAnalysis[] = [];

  scanFileCount = 0;
  isScanning = false;
  validationResult: ValidationResult | null = null;
  private pendingValidationPath: string | null = null;
  private scanProgressUnsub: (() => void) | null = null;

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
    private readonly pendingRepo: PendingRepositoryService,
    private readonly electronService: ElectronService,
    private readonly fileInventory: FileInventoryService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly targetValidation: TargetValidationService,
    private readonly zone: NgZone,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('repository-analysis') ?? [220, 460];

    const pending = this.pendingRepo.consume();
    if (pending) {
      const id = this.manager.activeId;
      if (id) this.manager.setRepositoryId(id, pending.repositoryId);
      this.loadFromPath(pending.path);
      this.loadAnalysisHistory(pending.repositoryId);
    }

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

    // Generate security and system understanding once knowledge pipeline completes.
    // All four analysis calls are guarded — if the workspace already has the result
    // (navigating back to a completed analysis) we skip recomputation entirely.
    this.securitySub = this.knowledgeService.knowledge$.subscribe(async knowledge => {
      const id = this.manager.activeId;
      if (knowledge && id) {
        const ws = this.manager.getById(id);

        let security: SecurityAnalysis;
        const cachedSecurity = ws?.securityAnalysis;
        if (cachedSecurity) {
          security = cachedSecurity;
        } else {
          security = await this.securityService.analyzeKnowledge(knowledge, this.session);
          this.manager.setSecurityAnalysis(id, security);
        }

        if (!ws?.systemUnderstanding) {
          const understanding = await this.understandingService.analyzeKnowledge(knowledge, this.session);
          this.manager.setSystemUnderstanding(id, understanding);
        }

        if (!ws?.recommendationAnalysis) {
          const recs = await this.recService.analyzeKnowledge(knowledge, this.session);
          this.manager.setRecommendationAnalysis(id, recs);
        }

        const wsAfter = this.manager.getById(id);
        if (!wsAfter?.learningPathAnalysis && wsAfter?.systemUnderstanding) {
          const lp = await this.learningPathService.analyzeKnowledge(knowledge, this.session, wsAfter.systemUnderstanding, 'repository');
          this.manager.setLearningPathAnalysis(id, lp);
        }

        // Fire explanation and security overview concurrently — neither depends on
        // the other's result. Both are skipped if already cached.
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

        if (ctx && !this.manager.getById(id)?.securityOverview) {
          this.aiKnowledge.generateSecurityOverview(ctx, security, 'repository').subscribe({
            next: overview => this.manager.setSecurityOverview(id, overview),
            error: () => { /* AI unavailable — overview stays null, page degrades gracefully */ },
          });
        }
      }
    });
  }

  private async loadFromPath(folderPath: string): Promise<void> {
    const validation = await this.targetValidation.validate(folderPath, 'repository');
    if (!validation.valid && validation.mismatch) {
      this.pendingValidationPath = folderPath;
      this.validationResult = validation;
      return;
    }
    if (!validation.valid) {
      return;
    }

    this.isScanning = true;
    this.scanFileCount = 0;

    this.scanProgressUnsub = this.electronService.onScanProgress(event => {
      this.zone.run(() => { this.scanFileCount = event.count; });
    });

    const entries = await this.electronService.readDirectory(folderPath);

    this.scanProgressUnsub?.();
    this.scanProgressUnsub = null;
    this.isScanning = false;

    if (!entries) return;

    const files = entries.map(entry => {
      const blob = new Blob([entry.content ?? ''], { type: 'text/plain' });
      const file = new File([blob], entry.name, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', { value: entry.relativePath, writable: false });
      return file;
    });

    const metadata = this.fileInventory.buildMetadata(files);
    const profile = await this.workspaceClassifier.classify(metadata);

    this.zone.run(() => {
      this.currentWorkspace.set(profile, files);
      this.workspaceProfile = profile;
      this.buildTree(profile);
    });

    // Attempt incremental restore: if we have a saved analysis and no files have
    // changed since it was recorded, restore AI results from DB instead of re-running
    // the full pipeline.
    const id = this.manager.activeId;
    const ws = id ? this.manager.getById(id) : null;
    if (ws?.repositoryId) {
      const restored = await this.tryRestoreFromCache(ws.repositoryId, id!, entries);
      if (restored) return;
    }

    await this.knowledgeService.build(files, profile, entries);
  }

  private async tryRestoreFromCache(
    repositoryId: string,
    workspaceId: string,
    entries: ElectronDirectoryEntry[],
  ): Promise<boolean> {
    try {
      const saved = await this.electronService.getLatestAnalysis(repositoryId);
      if (!saved?.aiResult) return false;

      // Build a lightweight hash list from the current scan to check for changes.
      const currentHashes = entries
        .filter(e => e.content !== null)
        .map(e => ({ relativePath: e.relativePath, hash: hashContent(e.content!) }));

      const changedPaths = await this.electronService.getChangedFiles(repositoryId, currentHashes);
      if (changedPaths.length > 0) return false;

      // No changes — restore saved AI results into the workspace.
      const ai = saved.aiResult as any;
      if (ai.explanation) this.manager.setAiExplanation(workspaceId, ai.explanation as ExplanationResult);
      if (ai.securityOverview) this.manager.setSecurityOverview(workspaceId, ai.securityOverview as string);
      if (ai.systemUnderstanding) this.manager.setSystemUnderstanding(workspaceId, ai.systemUnderstanding as SystemUnderstanding);
      if (ai.recommendationAnalysis) this.manager.setRecommendationAnalysis(workspaceId, ai.recommendationAnalysis as RecommendationAnalysis);
      if (ai.learningPathAnalysis) this.manager.setLearningPathAnalysis(workspaceId, ai.learningPathAnalysis as LearningPathAnalysis);

      return true;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.contextSub?.unsubscribe();
    this.limitSub?.unsubscribe();
    this.securitySub?.unsubscribe();
    this.scanProgressUnsub?.();
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
    const pool = this.uploadedFiles.length > 0
      ? this.uploadedFiles
      : this.currentWorkspace.uploadedFiles;
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const target = norm(file.path);
    return pool.find(f => {
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

  onValidationProceed(target: AnalysisTarget): void {
    const path = this.pendingValidationPath;
    this.validationResult = null;
    this.pendingValidationPath = null;
    if (!path) return;

    if (target === 'repository') {
      this.loadFromPath(path);
    } else if (target === 'folder') {
      this.router.navigate(['/folder-analysis']);
    } else {
      this.router.navigate(['/file-analysis']);
    }
  }

  onValidationCancel(): void {
    this.validationResult = null;
    this.pendingValidationPath = null;
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

  get aiSummary(): string | null {
    return this.manager.getActive()?.aiExplanation?.content ?? null;
  }

  get technologyCount(): number {
    return this.workspaceProfile?.detectedTechnologies?.length
      ?? this.workspaceProfile?.technologies.length
      ?? 0;
  }

  get dependencyCount(): number {
    return this.manager.getActive()?.knowledge?.dependencyGraph?.edges.length ?? 0;
  }

  get displayRisks(): { severity: string; description: string }[] {
    const recs = this.manager.getActive()?.recommendationAnalysis?.recommendations ?? [];
    return recs
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .slice(0, 8)
      .map(r => ({ severity: r.riskLevel, description: r.issueDescription }));
  }

  get displayModernizations(): { description: string }[] {
    const recs = this.manager.getActive()?.recommendationAnalysis?.recommendations ?? [];
    return recs
      .filter(r => r.category === 'modernization')
      .slice(0, 6)
      .map(r => ({ description: r.recommendedImprovement }));
  }

  get subsystems(): { name: string; fileCount: number }[] {
    const structure = this.workspaceProfile?.repositoryStructure;
    if (!structure) return [];
    return structure.root.children
      .slice(0, 10)
      .map(folder => ({ name: folder.name, fileCount: folder.totalFileCount }))
      .filter(s => s.fileCount > 0);
  }

  // ── Analysis History ──────────────────────────────────────────────────────

  private async loadAnalysisHistory(repositoryId: string): Promise<void> {
    if (!this.electronService.isElectron) return;
    this.analysisHistory = await this.electronService.getAnalysisHistory(repositoryId);
  }

  restoreAnalysis(analysis: ElectronAnalysis): void {
    const id = this.manager.activeId;
    if (!id || !analysis.aiResult) return;
    const ai = analysis.aiResult as any;
    if (ai.explanation) this.manager.setAiExplanation(id, ai.explanation as ExplanationResult);
    if (ai.securityOverview) this.manager.setSecurityOverview(id, ai.securityOverview as string);
    if (ai.systemUnderstanding) this.manager.setSystemUnderstanding(id, ai.systemUnderstanding as SystemUnderstanding);
    if (ai.recommendationAnalysis) this.manager.setRecommendationAnalysis(id, ai.recommendationAnalysis as RecommendationAnalysis);
    if (ai.learningPathAnalysis) this.manager.setLearningPathAnalysis(id, ai.learningPathAnalysis as LearningPathAnalysis);
  }

  formatHistoryDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString();
  }
}
