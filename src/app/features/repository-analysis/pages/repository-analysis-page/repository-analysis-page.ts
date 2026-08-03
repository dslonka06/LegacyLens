import { Component, NgZone, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import {
  TargetValidationService,
  ValidationResult,
  AnalysisTarget,
} from '@app/core/services/target-validation.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { ElectronDirectoryEntry } from '../../../../../electron';
import { hashContent } from '@app/core/utils/hash';
import {
  buildAIPipelineState,
  type AIPipelineState,
} from '@app/shared/utils/ai-pipeline-state';
import type { LLMSummaryKey } from '@app/knowledge/models/llm-summaries.model';

export type HealthTier = 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown';

export interface HubMetricCard {
  id: string;
  icon: string;
  count: number | null;
  tags?: string[];
  subtitle?: string;
  label: string;
  route: string;
  suggested: boolean;
  pending: boolean;
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  cs: 'C#', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', sql: 'SQL',
  py: 'Python', json: 'JSON', xml: 'XML', md: 'Markdown', txt: 'Plain Text',
  sh: 'Shell', bash: 'Shell', yml: 'YAML', yaml: 'YAML', rs: 'Rust', go: 'Go',
  java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
  cpp: 'C++', c: 'C', h: 'C/C++ Header', hpp: 'C++ Header',
};

const STAGE_LABELS: Partial<Record<AIStage, string>> = {
  understanding: 'Understanding',
  security: 'Security',
  recommendations: 'Recommendations',
  learningPath: 'Learning Path',
  architecture: 'Architecture',
  dataFlow: 'Data Flow',
  documentation: 'Documentation',
  prompt: 'Prompt',
  generate: 'Generate',
};

const STAGE_MESSAGES: Record<string, string[]> = {
  understanding: ['Analysing structure...', 'Mapping capabilities...'],
  security: ['Scanning for vulnerabilities...', 'Evaluating risk...'],
  recommendations: ['Reviewing code patterns...', 'Generating suggestions...'],
  learningPath: ['Building learning plan...', 'Structuring path...'],
  architecture: ['Detecting patterns...', 'Assessing coupling...'],
  dataFlow: ['Tracing workflows...', 'Profiling risk...'],
  prompt: ['Building prompts...'],
  generate: ['Calling LLM...', 'Generating summaries...'],
};

@Component({
  selector: 'app-repository-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ValidationDialog, ThemeToggle],
  templateUrl: './repository-analysis-page.html',
  styleUrl: './repository-analysis-page.scss',
})
export class RepositoryAnalysisPage implements OnInit, OnDestroy {
  workspace: Workspace | null = null;
  model: KnowledgeModel | null = null;
  showSwitcher = false;
  switcherLimitReached = false;

  showIdentity = false;
  showInfoCards = false;
  showArcDraw = false;
  showHealthInfo = false;
  showAiInfo = false;
  showMetricCards = false;
  isReturning = false;

  displayedCounts: Record<string, number | undefined> = {};

  // Pipeline cycling status text per stage
  pipelineStatusText: Record<string, string> = {};
  private statusTimers: Record<string, ReturnType<typeof setInterval>> = {};
  private countTimers: ReturnType<typeof setInterval>[] = [];

  // Electron / repo loading state
  isScanning = false;
  scanFileCount = 0;
  validationResult: ValidationResult | null = null;

  private pendingValidationPath: string | null = null;
  private scanProgressUnsub: (() => void) | null = null;
  private sub: Subscription | null = null;
  private stagesSub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly electronService: ElectronService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly targetValidation: TargetValidationService,
    private readonly layoutService: PanelLayoutService,
    private readonly zone: NgZone,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly el: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.showHealthInfo && !this.showAiInfo) return;
    const host = this.el.nativeElement as HTMLElement;
    const wraps = host.querySelectorAll('.hub-info-popup-wrap');
    for (const wrap of Array.from(wraps)) {
      if (wrap.contains(event.target as Node)) return;
    }
    this.showHealthInfo = false;
    this.showAiInfo = false;
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    // Bootstrap synchronously — guards distinctUntilChanged suppressing the first
    // subscription emission when navigating back to a workspace with existing data.
    const boot = this.manager.getActive();
    if (boot) {
      this.workspace = boot;
      this.model     = boot.knowledgeModel ?? null;
      if (boot.knowledgeModel) {
        this.showIdentity = true;
        this.showInfoCards = true;
        this.showArcDraw = true;
        this.showMetricCards = true;
        this.animateCountsTo(this.metricCards);
      } else {
        this.runAnimations();
      }
    }

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prevId     = this.workspace?.id;
      const prevStatus = this.workspace?.status;
      const prevModel  = this.workspace?.knowledgeModel;
      const prevAi     = this.workspace?.knowledgeModel?.ai;

      this.workspace = ws;
      this.model     = ws?.knowledgeModel ?? null;

      const switched          = prevId !== ws?.id;
      const modelArrived      = !prevModel && !!ws?.knowledgeModel;
      const processingStarted = prevStatus !== 'processing' && ws?.status === 'processing';
      const aiUpdated         = !switched && !modelArrived && !!ws?.knowledgeModel
                                && ws.knowledgeModel.ai !== prevAi;

      if (switched && !!ws?.knowledgeModel) {
        this.showIdentity = true;
        this.showInfoCards = true;
        this.showArcDraw = true;
        this.showMetricCards = true;
      } else if (switched || modelArrived) {
        this.runAnimations();
      } else if (processingStarted) {
        this.runInfoCardAnimation();
      }

      if (modelArrived || aiUpdated) {
        this.animateCountsTo(this.metricCards);
      }

      this.cdr.detectChanges();
    });

    this.stagesSub = this.manager.activeStages$.subscribe(() => {
      const stages: AIStage[] = ['understanding', 'security', 'recommendations', 'learningPath'];
      stages.forEach((stage) => {
        const running = this.manager.getActiveStages(this.workspace?.id ?? '').has(stage);
        const hasTimer = !!this.statusTimers[stage];
        if (running && !hasTimer) {
          this.startStatusCycle(stage);
        } else if (!running && hasTimer) {
          this.stopStatusCycle(stage);
        }
      });
      this.cdr.detectChanges();
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());

    // Auto-load from stored path when returning to an empty workspace that has one
    if (this.workspace?.status === 'empty' && this.workspace.path) {
      this.loadFromPath(this.workspace.path);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stagesSub?.unsubscribe();
    this.limitSub?.unsubscribe();
    this.scanProgressUnsub?.();
    if (this.animTimer) clearTimeout(this.animTimer);
    this.stopAllStatusCycles();
    this.clearCountTimers();
  }

  // ── Pipeline status cycling ─────────────────────────────────

  startStatusCycle(stage: AIStage): void {
    const messages = STAGE_MESSAGES[stage] ?? ['Processing...'];
    let idx = 0;
    this.pipelineStatusText[stage] = messages[0];
    this.statusTimers[stage] = setInterval(() => {
      this.zone.run(() => {
        idx = (idx + 1) % messages.length;
        this.pipelineStatusText[stage] = messages[idx];
        this.cdr.detectChanges();
      });
    }, 2000);
  }

  stopStatusCycle(stage: AIStage): void {
    if (this.statusTimers[stage]) {
      clearInterval(this.statusTimers[stage]);
      delete this.statusTimers[stage];
    }
  }

  private stopAllStatusCycles(): void {
    Object.keys(this.statusTimers).forEach((stage) => {
      clearInterval(this.statusTimers[stage]);
    });
    this.statusTimers = {};
  }

  stageOutcome(stage: AIStage): string {
    const ai = this.model?.ai;
    switch (stage) {
      case 'understanding': {
        const caps = ai?.understanding?.coreCapabilities?.length ?? 0;
        return caps > 0 ? `${caps} capabilities` : 'Capabilities mapped';
      }
      case 'security': {
        const count = ai?.security?.findings?.length ?? 0;
        return `${count} finding${count !== 1 ? 's' : ''}`;
      }
      case 'recommendations': {
        const count = ai?.recommendations?.recommendations?.length ?? 0;
        return `${count} suggestion${count !== 1 ? 's' : ''}`;
      }
      case 'learningPath':
        return 'Path generated';
      default:
        return '';
    }
  }

  // ── Repo loading (Electron IPC) ────────────────────────────────────────────

  async pickAndLoadFolder(): Promise<void> {
    const folderPath = await this.electronService.pickFolder('Select Repository Folder');
    if (!folderPath) return;
    this.loadFromPath(folderPath);
  }

  private async loadFromPath(folderPath: string): Promise<void> {
    const validation = await this.targetValidation.validate(folderPath, 'repository');
    if (!validation.valid && validation.mismatch) {
      this.pendingValidationPath = folderPath;
      this.validationResult = validation;
      return;
    }
    if (!validation.valid) return;

    // Persist the path so returning sessions can re-scan without re-picking
    const activeId = this.manager.activeId;
    if (activeId) this.manager.setPath(activeId, folderPath);

    this.isScanning = true;
    this.scanFileCount = 0;

    this.scanProgressUnsub = this.electronService.onScanProgress((event) => {
      this.zone.run(() => {
        this.scanFileCount = event.count;
      });
    });

    const entries = await this.electronService.readDirectory(folderPath);
    this.scanProgressUnsub?.();
    this.scanProgressUnsub = null;
    this.isScanning = false;

    if (!entries) return;

    const files = entries.map((entry) => {
      const blob = new Blob([entry.content ?? ''], { type: 'text/plain' });
      const file = new File([blob], entry.name, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.relativePath,
        writable: false,
      });
      return file;
    });

    const metadata = this.buildFileMetadata(files);
    const profile = await this.workspaceClassifier.classify(metadata);

    this.zone.run(() => {
      this.currentWorkspace.set(profile, files);
    });

    const id = this.manager.activeId;
    const ws = id ? this.manager.getById(id) : null;
    if (ws?.repositoryId) {
      const restored = await this.tryRestoreFromCache(ws.repositoryId, id!, entries);
      if (restored) return;
    }

    if (!id) return;
    const repoName = folderPath.split(/[\\/]/).pop() ?? 'repository';
    this.manager.rename(id, repoName);
    this.knowledge
      .process('repository', entries, {
        workspaceId: id,
        repositoryId: ws?.repositoryId ?? undefined,
        repositoryPath: folderPath,
        workspaceName: repoName,
        persist: true,
      })
      .subscribe({ error: () => {} });
  }

  private async tryRestoreFromCache(
    repositoryId: string,
    workspaceId: string,
    entries: ElectronDirectoryEntry[],
  ): Promise<boolean> {
    try {
      const saved = await this.electronService.getLatestAnalysis(repositoryId);
      if (!saved?.aiResult) return false;

      const currentHashes = entries
        .filter((e) => e.content !== null)
        .map((e) => ({ relativePath: e.relativePath, hash: hashContent(e.content!) }));

      const changedPaths = await this.electronService.getChangedFiles(repositoryId, currentHashes);
      if (changedPaths.length > 0) return false;

      const restoredModel = await this.knowledge.getLatest(repositoryId);
      if (restoredModel) {
        this.manager.setKnowledgeModel(workspaceId, restoredModel);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private buildFileMetadata(files: File[]): FileMetadata[] {
    return files.map((f) => {
      const name = f.name;
      const path = (f as any).webkitRelativePath || name;
      const parts = name.toLowerCase().split('.');
      const extension = parts.length > 1 ? parts[parts.length - 1] : '';
      return {
        name,
        path,
        extension,
        language: EXT_TO_LANGUAGE[extension] ?? 'Unknown',
        size: f.size,
      };
    });
  }

  // ── Validation dialog ──────────────────────────────────────────────────────

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

  // ── Animations ─────────────────────────────────────────────────────────────

  private runAnimations(): void {
    if (this.animTimer) clearTimeout(this.animTimer);

    const alreadyVisible = this.showIdentity && this.showInfoCards;
    if (!alreadyVisible) {
      this.showIdentity = false;
      this.showInfoCards = false;
      this.showArcDraw = false;
      this.showMetricCards = false;
      this.cdr.detectChanges();
    }

    const fast = this.isReturning;
    const t = (ms: number) => (fast ? Math.round(ms * 0.4) : ms);
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    if (!alreadyVisible) {
      run(() => { this.showIdentity = true; }, t(80));
      run(() => { this.showInfoCards = true; }, t(220));
      // Arc draws after the info-card fade-in animation completes (~380ms from showInfoCards).
      // Slow: 220 + 420 = 640ms. Fast: 88 + 200 = 288ms.
      run(() => { this.showArcDraw = true; }, t(640));
    }
    this.animTimer = run(() => { this.showMetricCards = true; }, t(780));
  }

  private runInfoCardAnimation(): void {
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showIdentity = true; }, 80);
    run(() => { this.showInfoCards = true; }, 150);
    // Arc draws after info-card fade-in (150ms start + 380ms animation = 530ms).
    run(() => { this.showArcDraw = true; }, 560);
  }

  private animateCountsTo(cards: HubMetricCard[]): void {
    this.clearCountTimers();
    for (const card of cards) {
      if (card.count === null || card.count === 0) {
        this.displayedCounts[card.id] = card.count ?? 0;
        continue;
      }
      const target = card.count;
      const steps = Math.min(target, 30);
      const intervalMs = 600 / steps;
      let current = 0;
      const timer = setInterval(() => {
        this.zone.run(() => {
          current = Math.min(current + Math.ceil(target / steps), target);
          this.displayedCounts[card.id] = current;
          this.cdr.detectChanges();
          if (current >= target) clearInterval(timer);
        });
      }, intervalMs);
      this.countTimers.push(timer);
    }
  }

  private clearCountTimers(): void {
    this.countTimers.forEach((t) => clearInterval(t));
    this.countTimers = [];
  }

  // ── Workspace actions ──────────────────────────────────────────────────────

  reanalyze(): void {
    const ws = this.workspace;
    if (!ws) return;

    const obs = this.knowledge.reanalyze(ws.id);
    if (obs) { obs.subscribe({ error: () => {} }); return; }

    // Cold path: input cache is empty (e.g. restored from SQLite) — re-scan from stored path.
    const path = ws.path;
    if (!path) return;
    this.loadFromPath(path);
  }

  newWorkspace(): void {
    if (!this.manager.canCreate()) {
      this.openSwitcher();
      return;
    }
    this.manager.create('repository');
  }

  deleteWorkspace(): void {
    if (this.workspace) this.manager.delete(this.workspace.id);
  }

  switchWorkspace(id: string): void {
    this.manager.activate(id);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
  }

  goToLibrary(): void {
    this.router.navigate(['/library'], { queryParams: { type: 'repository' } });
  }

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  get isEmpty(): boolean {
    const s = this.workspace?.status;
    return !s || s === 'empty' || s === 'failed';
  }

  get isAnalyzing(): boolean {
    return this.workspace?.status === 'processing';
  }

  get hasModel(): boolean {
    return !!this.model;
  }

  get repoName(): string {
    return this.workspace?.name ?? 'Repository';
  }

  get lastAnalyzed(): string {
    if (!this.model?.metadata.builtAt) return '';
    return new Date(this.model.metadata.builtAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get statusLabel(): string {
    const map: Record<WorkspaceStatus, string> = {
      empty: 'Empty',
      processing: 'Analyzing',
      ready: 'Ready',
      failed: 'Incomplete',
      error: 'Error',
    };
    return map[this.workspace?.status ?? 'empty'];
  }

  get statusChipClass(): string {
    switch (this.workspace?.status) {
      case 'ready': return 'workspace-status-chip--ready';
      case 'processing': return 'workspace-status-chip--processing';
      case 'failed':
      case 'error': return 'workspace-status-chip--failed';
      default: return 'workspace-status-chip--empty';
    }
  }

  get canReanalyze(): boolean {
    return this.knowledge.canReanalyze(this.workspace?.id ?? '') && !this.isAnalyzing;
  }

  get workspaceList(): Workspace[] {
    return this.manager.workspaces.filter((w) => w.type === this.workspace?.type);
  }

  // ── Repo metrics ───────────────────────────────────────────────────────────

  get fileCount(): number {
    return this.model?.structure.totalFiles ?? 0;
  }

  get subfolderCount(): number {
    return this.model?.structure.folderTree?.children?.length ?? 0;
  }

  get languageList(): string {
    const langs = this.model?.structure.languages ?? [];
    return langs.length ? langs.slice(0, 3).join(', ') : '—';
  }

  get primaryFrameworks(): string {
    const fw = this.model?.structure.frameworks ?? [];
    return fw.length ? fw.slice(0, 3).join(', ') : '—';
  }

  get technologyCount(): number {
    return this.model?.structure.technologies.length ?? 0;
  }

  get dependencyCount(): number {
    return this.model?.relationships.dependencies?.graph?.edges.length ?? 0;
  }

  get architecturePatterns(): string[] {
    return this.model?.relationships.architecture?.patterns.map((p) => p.name) ?? [];
  }


  get topSubsystems(): { name: string; fileCount: number }[] {
    const tree = this.model?.structure.folderTree;
    if (!tree) return [];
    return (tree.children ?? [])
      .slice(0, 6)
      .map((f: any) => ({ name: f.name, fileCount: f.totalFileCount ?? f.fileCount ?? 0 }))
      .filter((s: any) => s.fileCount > 0);
  }

  // ── Code Health ────────────────────────────────────────────────────────────

  get healthTier(): HealthTier {
    if (!this.model) return 'unknown';
    const c = this.model.insights.complexity;
    const m = this.model.insights.maintainability;
    if (!c || !m) return 'unknown';

    if (c === 'High' || m === 'Low') return 'critical';
    if (c === 'Low' && m === 'High') return 'healthy';
    if (c === 'Medium' || m === 'Medium') return 'fair';
    return 'needs-attention';
  }

  get healthLabel(): string {
    const map: Record<HealthTier, string> = {
      healthy: 'Healthy',
      fair: 'Fair',
      'needs-attention': 'Needs Attention',
      critical: 'Critical',
      unknown: 'Pending',
    };
    return map[this.healthTier];
  }

  get complexityLabel(): string {
    return this.model?.insights.complexity ?? '—';
  }
  get maintainabilityLabel(): string {
    return this.model?.insights.maintainability ?? '—';
  }

  // ── AI Pipeline card ──────────────────────────────────────────────────────

  get aiPipeline(): AIPipelineState {
    return buildAIPipelineState(this.model, this.workspace, this.manager);
  }

  get pipelineHasFailure(): boolean {
    return this.aiPipeline.hasFailure;
  }

  get coreAnalysisState(): 'complete' | 'partial' | 'running' | 'failed' | 'idle' {
    const stage = this.aiPipeline.stages.find(s => s.id === 'derive');
    if (!stage) return 'idle';
    if (stage.state === 'partial') return 'partial';
    return stage.state as any;
  }

  get coreAnalysisLabel(): string {
    switch (this.coreAnalysisState) {
      case 'complete': return 'Complete';
      case 'partial':  return 'Partial';
      case 'running':  return 'Running…';
      case 'failed':   return 'Failed';
      default:         return 'Pending';
    }
  }

  get aiInsightsState(): 'complete' | 'partial' | 'running' | 'failed' | 'idle' {
    if (this.aiPipeline.noProvider) return 'failed';
    const ai = this.model?.ai;
    const summaryKeys: LLMSummaryKey[] = ['understanding', 'security', 'recommendations', 'learningPath'];
    const statuses = summaryKeys.map(k => ai?.summaries?.[k]?.status);
    const allSettled = statuses.every(s => s === 'complete' || s === 'failed');
    const anyComplete = statuses.some(s => s === 'complete');
    const anyFailed = statuses.some(s => s === 'failed');
    if (allSettled && anyComplete && !anyFailed) return 'complete';
    if (allSettled && anyFailed && !anyComplete) return 'failed';
    if (allSettled) return 'partial';
    const gen = this.aiPipeline.stages.find(s => s.id === 'generate');
    if (gen?.state === 'running') return 'running';
    if (anyComplete || anyFailed) return 'partial';
    return gen?.state as any ?? 'idle';
  }

  get aiInsightsLabel(): string {
    if (this.aiPipeline.noProvider) return 'Unavailable';
    switch (this.aiInsightsState) {
      case 'complete': return 'Complete';
      case 'partial':  return 'Partial';
      case 'running':  return 'Running…';
      case 'failed':   return 'Failed';
      default:         return 'Pending';
    }
  }


  get pipelineStages(): { key: string; label: string; state: 'complete' | 'failed' | 'running' | 'pending' }[] {
    const ai = this.model?.ai;
    const running = this.manager.getActiveStages(this.workspace?.id ?? '');
    const generateRunning = running.has('generate');

    const summaryState = (k: LLMSummaryKey): 'complete' | 'failed' | 'running' | 'pending' => {
      const status = ai?.summaries?.[k]?.status;
      if (status === 'complete') return 'complete';
      if (status === 'failed')   return 'failed';
      if (generateRunning)       return 'running';
      return 'pending';
    };

    return [
      { key: 'understanding',   label: 'Understanding',   state: summaryState('understanding') },
      { key: 'architecture',    label: 'Architecture',    state: summaryState('architecture') },
      { key: 'dataFlow',        label: 'Data Flow',       state: summaryState('dataFlow') },
      { key: 'security',        label: 'Security',        state: summaryState('security') },
      { key: 'recommendations', label: 'Recommendations', state: summaryState('recommendations') },
      { key: 'learningPath',    label: 'Learning Path',   state: summaryState('learningPath') },
    ];
  }

  // ── Identity metrics ─────────────────────────────────────────

  get identityMetrics(): { label: string; value: string }[] {
    if (!this.model) return [];
    return [
      { label: 'Primary Language', value: this.model.structure.languages?.[0] ?? '—' },
      { label: 'Files', value: String(this.fileCount) },
      { label: 'Subfolders', value: String(this.subfolderCount) },
    ];
  }

  // ── Detected role tags ─────────────────────────────────────────

  get detectedRoleTags(): string[] {
    const langs = this.model?.structure.languages ?? [];
    const techs = (this.model?.structure.technologies ?? []).map((t: any) => t.technology ?? t);
    const combined = [...new Set([...langs, ...techs])];
    return combined.filter(Boolean).slice(0, 5);
  }

  // ── AI analysis statistics ─────────────────────────────────────

  get aiStats(): { label: string; value: string }[] {
    const ai = this.model?.ai;
    if (!ai) return [];
    const fileCount = this.model?.structure.totalFiles ?? 0;
    const moduleCount = this.model?.structure.projects?.length ?? 0;
    const depCount = this.dependencyCount;
    return [
      { label: 'Files analyzed', value: String(fileCount) },
      { label: 'Modules detected', value: String(moduleCount) },
      { label: 'Dependencies mapped', value: String(depCount) },
    ];
  }

  get executiveSummary(): string {
    return this.model?.ai?.understanding?.executiveSummary ?? '';
  }

  get hubNarrative(): string {
    const hn = this.model?.ai?.hubNarrative;
    if (!hn) return '';
    return [hn.structural, hn.directive].filter(Boolean).join(' ');
  }

  // ── Metric cards ───────────────────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai = this.model?.ai;
    const base = '/repository-analysis';
    const suggested = this.suggestedRoute;

    return [
      {
        id: 'dependencies',
        icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
        count: this.dependencyCount > 0 ? this.dependencyCount : null,
        subtitle: 'Dependencies & Relations',
        label: 'Dependencies & Relations',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('dependencyResolution'),
      },
      {
        id: 'architecture',
        icon: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
        count: ai?.architecture?.hubCount ?? null,
        subtitle: 'Hub Nodes',
        label: 'Architecture',
        route: `${base}/architecture`,
        suggested: false,
        pending: !ai?.completedStages?.includes('architecture'),
      },
      {
        id: 'dataflow',
        icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
        count: ai?.dataFlow?.workflowCount ?? null,
        subtitle: 'Workflows detected',
        label: 'Data Flow',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !ai?.completedStages?.includes('dataFlow'),
      },
      {
        id: 'security',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        count: ai?.security?.findings?.length ?? null,
        subtitle: 'Security Issues',
        label: 'Security',
        route: `${base}/security`,
        suggested: suggested === 'security',
        pending: !ai?.completedStages?.includes('security'),
      },
      {
        id: 'recommendations',
        icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
        count: ai?.recommendations?.recommendations?.length ?? null,
        subtitle: 'Recommendations',
        label: 'Recommendations',
        route: `${base}/code-recommendations`,
        suggested: suggested === 'recommendations',
        pending: !ai?.completedStages?.includes('recommendations'),
      },
      {
        id: 'learning',
        icon: 'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
        count: null,
        subtitle: 'Personalized roadmap for this repository',
        label: 'Learning Path',
        route: `${base}/learning-path`,
        suggested: false,
        pending: !ai?.completedStages?.includes('learningPath'),
      },
    ];
  }

  private get suggestedRoute(): string {
    const findings = this.model?.ai?.security?.findings ?? [];
    const critical = findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    ).length;
    const recCount = this.model?.ai?.recommendations?.recommendations?.length ?? 0;

    if (critical > 0) return 'security';
    if (findings.length > 0) return 'security';
    if (recCount > 3) return 'recommendations';
    return 'understanding';
  }
}
