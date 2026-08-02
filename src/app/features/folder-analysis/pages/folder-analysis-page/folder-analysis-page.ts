import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { TargetValidationService, ValidationResult, AnalysisTarget } from '@app/core/services/target-validation.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';
import type { ElectronDirectoryEntry } from '../../../../../electron';
import { hashContent } from '@app/core/utils/hash';
import {
  buildAIPipelineState,
  type AIPipelineState,
} from '@app/shared/utils/ai-pipeline-state';
import type { LLMSummaryKey } from '@app/knowledge/models/llm-summaries.model';

const EXT_TO_LANGUAGE: Record<string, string> = {
  cs: 'C#', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', sql: 'SQL',
  py: 'Python', json: 'JSON', xml: 'XML', md: 'Markdown', txt: 'Plain Text',
  sh: 'Shell', bash: 'Shell', yml: 'YAML', yaml: 'YAML', rs: 'Rust', go: 'Go',
  java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
  cpp: 'C++', c: 'C', h: 'C/C++ Header', hpp: 'C++ Header',
};

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


@Component({
  selector: 'app-folder-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ValidationDialog, ThemeToggle],
  templateUrl: './folder-analysis-page.html',
  styleUrl: './folder-analysis-page.scss',
})
export class FolderAnalysisPage implements OnInit, OnDestroy {
  workspace: Workspace | null = null;
  model: KnowledgeModel | null = null;
  showSwitcher = false;
  switcherLimitReached = false;
  showHealthInfo = false;

  showIdentity = false;
  showInfoCards = false;
  showArcDraw = false;
  showMetricCards = false;
  isReturning = false;

  displayedCounts: Record<string, number> = {};

  uploadError: string | null = null;
  isDragging = false;

  isScanning = false;
  scanFileCount = 0;
  validationResult: ValidationResult | null = null;

  private pendingValidationPath: string | null = null;
  private scanProgressUnsub: (() => void) | null = null;
  private destroyed = false;
  private sub: Subscription | null = null;
  private stagesSub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  // animTimers tracks ALL pending animation timeouts so every one can be
  // cancelled atomically when runAnimations fires again.
  private animTimers: ReturnType<typeof setTimeout>[] = [];
  private countTimers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly electronService: ElectronService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly targetValidation: TargetValidationService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly el: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.showHealthInfo) return;
    const wrap = (this.el.nativeElement as HTMLElement).querySelector('.hub-info-popup-wrap');
    if (wrap && !wrap.contains(event.target as Node)) {
      this.showHealthInfo = false;
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    // Bootstrap synchronously from the current manager state. This handles the
    // navigation-back case where distinctUntilChanged() on activeWorkspace$
    // suppresses the first emission (the guard calls _activeId$.next with the
    // same id, causing switchMap to re-emit the same object reference, which
    // distinctUntilChanged then swallows).
    const boot = this.manager.getActive();
    if (boot) {
      this.workspace = boot;
      this.model     = boot.knowledgeModel ?? null;
      if (boot.knowledgeModel) {
        // Returning to a workspace that already has data — show everything immediately,
        // no animation flash needed.
        this.showIdentity = true;
        this.showInfoCards = true;
        this.showArcDraw = true;
        this.showMetricCards = true;
        this.animateCountsTo(this.metricCards);
      } else {
        this.runAnimations(false);
      }
      this.cdr.detectChanges();
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
        // Switching to a workspace that already has a model — show immediately.
        this.showIdentity = true;
        this.showInfoCards = true;
        this.showArcDraw = true;
        this.showMetricCards = true;
      } else if (switched || modelArrived) {
        this.runAnimations(false);
      } else if (processingStarted) {
        this.runAnimations(true);
      }

      if (modelArrived || aiUpdated) {
        this.animateCountsTo(this.metricCards);
      }

      this.cdr.detectChanges();
    });

    // activeStages$ drives the live running-state display inside the pipeline
    // card. Without this subscription, stage spinners only update when
    // activeWorkspace$ coincidentally emits for another reason (e.g. a derive
    // stage completing), leaving the running indicators stale or missing.
    this.stagesSub = this.manager.activeStages$.subscribe(() => {
      this.cdr.detectChanges();
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());

    // Auto-load from stored path when workspace is empty but has a path from a previous session
    if (this.workspace?.status === 'empty' && this.workspace.path) {
      this.loadFromPath(this.workspace.path);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.sub?.unsubscribe();
    this.stagesSub?.unsubscribe();
    this.limitSub?.unsubscribe();
    this.scanProgressUnsub?.();
    this.clearAnimTimers();
    this.clearCountTimers();
  }

  // ── Animation sequence ────────────────────────────────────────
  // processingOnly = true: workspace just started processing — only animate
  // identity + info row into view, leave metric cards alone.

  private runAnimations(processingOnly: boolean): void {
    this.clearAnimTimers();

    const alreadyVisible = this.showIdentity && this.showInfoCards;
    if (!alreadyVisible) {
      this.showIdentity     = false;
      this.showInfoCards    = false;
      this.showArcDraw      = false;
      if (!processingOnly) this.showMetricCards = false;
      this.cdr.detectChanges();
    }

    const fast = this.isReturning;
    const t = (ms: number) => (fast ? Math.round(ms * 0.4) : ms);

    const run = (fn: () => void, delay: number): ReturnType<typeof setTimeout> =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    if (!alreadyVisible) {
      this.animTimers.push(run(() => { this.showIdentity  = true; }, t(80)));
      this.animTimers.push(run(() => { this.showInfoCards = true; }, t(220)));
    }

    // showArcDraw is ALWAYS rescheduled regardless of alreadyVisible — the arc
    // needs to re-trigger its CSS transition even if the card was already on screen
    // (e.g. when AI results arrive after processing started).
    this.animTimers.push(run(() => {
      // Double rAF ensures the info card has painted before the CSS transition
      // for the arc stroke-dashoffset fires. Without this, the transition starts
      // while the info-row hub-section--animate (380ms) is still running and the
      // arc element is still invisible — the transition fires but is never seen.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.zone.run(() => { this.showArcDraw = true; this.cdr.detectChanges(); });
      }));
    }, t(640)));

    if (!processingOnly) {
      this.animTimers.push(run(() => { this.showMetricCards = true; }, t(380)));
    }
  }

  private clearAnimTimers(): void {
    this.animTimers.forEach((t) => clearTimeout(t));
    this.animTimers = [];
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

  // ── Upload ────────────────────────────────────────────────────

  async pickAndLoadFolder(): Promise<void> {
    const folderPath = await this.electronService.pickFolder('Select Folder');
    if (!folderPath) return;
    this.loadFromPath(folderPath);
  }

  browseFolder(): void {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    (input as any).mozdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) this.processFiles(Array.from(input.files));
    };
    input.click();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.processFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  private async loadFromPath(folderPath: string): Promise<void> {
    const validation = await this.targetValidation.validate(folderPath, 'folder');
    if (this.destroyed) return;
    if (!validation.valid && validation.mismatch) {
      this.pendingValidationPath = folderPath;
      this.validationResult = validation;
      return;
    }
    if (!validation.valid) return;

    const activeId = this.manager.activeId;
    if (!activeId) return;

    this.manager.setPath(activeId, folderPath);

    this.isScanning = true;
    this.scanFileCount = 0;
    this.cdr.detectChanges();

    this.scanProgressUnsub = this.electronService.onScanProgress((event) => {
      this.zone.run(() => {
        if (this.destroyed) return;
        this.scanFileCount = event.count;
        this.cdr.detectChanges();
      });
    });

    const entries = await this.electronService.readDirectory(folderPath);
    this.scanProgressUnsub?.();
    this.scanProgressUnsub = null;

    if (this.destroyed) return;

    this.zone.run(() => {
      this.isScanning = false;
      this.cdr.detectChanges();
    });

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

    if (this.destroyed) return;

    this.zone.run(() => {
      this.currentWorkspace.set(profile, files);
    });

    const id = this.manager.activeId;
    const ws = id ? this.manager.getById(id) : null;
    if (ws?.repositoryId) {
      const restored = await this.tryRestoreFromCache(ws.repositoryId, id!, entries);
      if (this.destroyed) return;
      if (restored) return;
    }

    if (!id) return;
    this.zone.run(() => {
      this.knowledge
        .process('folder', entries, {
          workspaceId: id,
          workspaceName: profile.files[0]?.name ?? folderPath.split(/[\\/]/).pop() ?? 'folder',
          persist: true,
        })
        .subscribe({ error: () => {} });
    });
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

  private processFiles(files: File[]): void {
    this.uploadError = null;

    if (files.length === 1 && !files[0].type && files[0].size === 0) {
      this.uploadError = 'Could not read that folder. Try using the Browse button.';
      return;
    }

    const id = this.manager.activeId;
    if (!id) return;

    const folderName =
      (files[0] as any).webkitRelativePath?.split('/')[0] ??
      files[0].name.replace(/\.[^.]+$/, '') ??
      'folder';

    this.manager.rename(id, folderName);

    this.filesToEntries(files).then((entries) => {
      this.knowledge
        .process('folder', entries, { workspaceId: id, workspaceName: folderName, persist: false })
        .subscribe({ error: () => {} });
    });
  }

  private filesToEntries(files: File[]): Promise<ElectronDirectoryEntry[]> {
    return Promise.all(
      files.map(
        (f) =>
          new Promise<ElectronDirectoryEntry>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                relativePath: (f as any).webkitRelativePath || f.name,
                content: reader.result as string,
                size: f.size,
                modifiedAt: new Date(f.lastModified).toISOString(),
              });
            reader.onerror = () =>
              resolve({
                name: f.name,
                relativePath: (f as any).webkitRelativePath || f.name,
                content: null,
                size: f.size,
                modifiedAt: new Date(f.lastModified).toISOString(),
              });
            reader.readAsText(f);
          }),
      ),
    );
  }

  // ── Validation dialog ─────────────────────────────────────────

  onValidationProceed(target: AnalysisTarget): void {
    const path = this.pendingValidationPath;
    this.validationResult = null;
    this.pendingValidationPath = null;
    if (!path) return;

    if (target === 'folder') {
      this.loadFromPath(path);
    } else if (target === 'repository') {
      this.router.navigate(['/repository-analysis']);
    } else {
      this.router.navigate(['/file-analysis']);
    }
  }

  onValidationCancel(): void {
    this.validationResult = null;
    this.pendingValidationPath = null;
  }

  // ── Workspace actions ─────────────────────────────────────────

  reanalyze(): void {
    const ws = this.workspace;
    if (!ws) return;

    const obs = this.knowledge.reanalyze(ws.id);
    if (obs) { obs.subscribe({ error: () => {} }); return; }

    // Cold path: re-read from stored path (Electron only)
    const path = ws.path;
    if (!path) return;
    this.loadFromPath(path);
  }

  newWorkspace(): void {
    if (!this.manager.canCreate()) { this.openSwitcher(); return; }
    this.manager.create('folder');
  }

  deleteWorkspace(): void {
    if (this.workspace) this.manager.delete(this.workspace.id);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
  }

  goToLibrary(): void {
    this.router.navigate(['/library'], { queryParams: { type: 'folder' } });
  }

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  // ── Status helpers ────────────────────────────────────────────

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

  get folderName(): string {
    return this.workspace?.name ?? 'Untitled';
  }

  get lastAnalyzed(): string {
    if (!this.model?.metadata.builtAt) return '';
    return new Date(this.model.metadata.builtAt).toLocaleString([], {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  get statusLabel(): string {
    const map: Record<WorkspaceStatus, string> = {
      empty: 'Empty', processing: 'Analyzing', ready: 'Ready', failed: 'Incomplete', error: 'Error',
    };
    return map[this.workspace?.status ?? 'empty'];
  }

  get statusChipClass(): string {
    switch (this.workspace?.status) {
      case 'ready':            return 'workspace-status-chip--ready';
      case 'processing':       return 'workspace-status-chip--processing';
      case 'failed':
      case 'error':            return 'workspace-status-chip--failed';
      default:                 return 'workspace-status-chip--empty';
    }
  }

  get canReanalyze(): boolean {
    return this.knowledge.canReanalyze(this.workspace?.id ?? '') && !this.isAnalyzing;
  }

  get workspaceList(): Workspace[] {
    return this.manager.workspaces.filter((w) => w.type === this.workspace?.type);
  }

  // ── Folder metrics ────────────────────────────────────────────

  get fileCount(): number { return this.model?.structure.totalFiles ?? 0; }

  get subfolderCount(): number { return this.model?.structure.folderTree?.children?.length ?? 0; }

  get languageList(): string {
    const langs = this.model?.structure.languages ?? [];
    return langs.length ? langs.slice(0, 4).join(', ') : '—';
  }

  get dependencyCount(): number {
    return this.model?.relationships.dependencies?.graph?.edges.length ?? 0;
  }

  get primaryFrameworks(): string {
    const fw = this.model?.structure.frameworks ?? [];
    return fw.length ? fw.slice(0, 3).join(', ') : '—';
  }

  // ── Code Health ───────────────────────────────────────────────

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
      healthy: 'Healthy', fair: 'Fair', 'needs-attention': 'Needs Attention',
      critical: 'Critical', unknown: 'Pending',
    };
    return map[this.healthTier];
  }

  get complexityLabel(): string { return this.model?.insights.complexity ?? '—'; }
  get maintainabilityLabel(): string { return this.model?.insights.maintainability ?? '—'; }

  // ── AI Pipeline card ──────────────────────────────────────────

  get aiPipeline(): AIPipelineState {
    const state = buildAIPipelineState(this.model, this.workspace, this.manager);
    // IPC directory scan runs before setProcessing — override scan bubble to
    // show 'running' while the component is in scanning state.
    if (this.isScanning && state.stages[0]?.state === 'idle') {
      state.stages[0] = { ...state.stages[0], state: 'running' };
    }
    return state;
  }

  get pipelineHasFailure(): boolean { return this.aiPipeline.hasFailure; }

  get coreAnalysisState(): 'complete' | 'partial' | 'running' | 'failed' | 'idle' {
    const stage = this.aiPipeline.stages.find((s) => s.id === 'derive');
    if (!stage) return 'idle';
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
    const statuses = summaryKeys.map((k) => ai?.summaries?.[k]?.status);
    const allSettled = statuses.every((s) => s === 'complete' || s === 'failed');
    const anyComplete = statuses.some((s) => s === 'complete');
    const anyFailed = statuses.some((s) => s === 'failed');
    if (allSettled && anyComplete && !anyFailed) return 'complete';
    if (allSettled && anyFailed && !anyComplete) return 'failed';
    if (allSettled) return 'partial';
    const gen = this.aiPipeline.stages.find((s) => s.id === 'generate');
    if (gen?.state === 'running') return 'running';
    if (anyComplete || anyFailed) return 'partial';
    return (gen?.state as any) ?? 'idle';
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
    const generateRunning = this.manager.getActiveStages(this.workspace?.id ?? '').has('generate');

    const summaryState = (k: LLMSummaryKey): 'complete' | 'failed' | 'running' | 'pending' => {
      const status = ai?.summaries?.[k]?.status;
      if (status === 'complete') return 'complete';
      if (status === 'failed')   return 'failed';
      if (generateRunning)       return 'running';
      return 'pending';
    };

    return [
      { key: 'understanding',   label: 'Understanding',   state: summaryState('understanding') },
      { key: 'security',        label: 'Security Review', state: summaryState('security') },
      { key: 'recommendations', label: 'Recommendations', state: summaryState('recommendations') },
      { key: 'learningPath',    label: 'Learning Path',   state: summaryState('learningPath') },
    ];
  }

  // ── Identity ──────────────────────────────────────────────────

  get identityMetrics(): { label: string; value: string }[] {
    if (!this.model) return [];
    const dominantPattern = this.model.ai?.architecture?.dominantPattern;
    const patternValue = dominantPattern && dominantPattern !== 'Undetected' ? dominantPattern : null;
    return [
      { label: 'Primary Language', value: this.model.structure.languages?.[0] ?? '—' },
      { label: 'Files', value: String(this.fileCount) },
      { label: 'Subfolders', value: String(this.subfolderCount) },
      ...(patternValue ? [{ label: 'Pattern', value: patternValue }] : []),
    ];
  }

  get detectedRoleTags(): string[] {
    const langs = this.model?.structure.languages ?? [];
    const techs = (this.model?.structure.technologies ?? []).map((t: any) => t.technology ?? t);
    return [...new Set([...langs, ...techs])].filter(Boolean).slice(0, 5);
  }

  get hubNarrative(): string {
    const hn = this.model?.ai?.hubNarrative;
    if (!hn) return '';
    return [hn.structural, hn.directive].filter(Boolean).join(' ');
  }

  // ── Metric cards ──────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai = this.model?.ai;
    const base = '/folder-analysis';
    const suggested = this.suggestedRoute;
    const flowSteps = this.model?.insights.dataFlow?.steps?.length ?? 0;

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
        count: this.model?.relationships.architecture?.patterns.length ?? null,
        subtitle: 'Architecture Patterns',
        label: 'Architecture',
        route: `${base}/architecture`,
        suggested: false,
        // Uses AI completion rather than capabilities, because architectureDiscovery
        // is not in the folder capability map — it arrives via the AI pipeline.
        pending: !ai?.completedStages?.includes('architecture'),
      },
      {
        id: 'dataflow',
        icon: 'M22 12H18L15 21 9 3 6 12 2 12',
        count: flowSteps,
        subtitle: 'Data Flow Steps',
        label: 'Data Flow',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('dependencyResolution'),
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
        icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
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
        subtitle: 'Personalized roadmap for this folder',
        label: 'Learning Path',
        route: `${base}/learning-path`,
        suggested: false,
        pending: !ai?.completedStages?.includes('learningPath'),
      },
    ];
  }

  private get suggestedRoute(): string {
    const findings = this.model?.ai?.security?.findings ?? [];
    const critical = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
    const recCount = this.model?.ai?.recommendations?.recommendations?.length ?? 0;
    if (critical > 0 || findings.length > 0) return 'security';
    if (recCount > 3) return 'recommendations';
    return 'understanding';
  }
}
