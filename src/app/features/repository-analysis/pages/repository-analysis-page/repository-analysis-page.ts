import { Component, NgZone, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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

export type HealthTier = 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown';

export interface HubMetricCard {
  id: string;
  icon: string;
  count: number | null;
  tags?: string[];
  label: string;
  route: string;
  suggested: boolean;
  pending: boolean;
}

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
  showMetricCards = false;
  isReturning = false;

  // Pipeline cycling status text per stage
  pipelineStatusText: Record<string, string> = {};
  private statusTimers: Record<string, ReturnType<typeof setInterval>> = {};

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
  ) {}

  ngOnInit(): void {
    const init = this.manager.getActive();
    this.workspace = init ?? null;
    this.model = init?.knowledgeModel ?? null;
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prevId = this.workspace?.id;
      const prevStatus = this.workspace?.status;
      const prevModel = this.workspace?.knowledgeModel;
      const prevAi = this.workspace?.knowledgeModel?.ai;
      this.workspace = ws;
      this.model = ws?.knowledgeModel ?? null;

      const switched = prevId !== ws?.id;
      const modelArrived = !prevModel && !!ws?.knowledgeModel;
      const processingStarted = prevStatus !== 'processing' && ws?.status === 'processing';
      const aiUpdated = !switched && !modelArrived && !!ws?.knowledgeModel &&
        ws.knowledgeModel.ai !== prevAi;
      console.log('[RepoHub] ws update', {
        switched,
        modelArrived,
        aiUpdated,
        prevAiSame: prevAi === ws?.knowledgeModel?.ai,
        completedStages: ws?.knowledgeModel?.ai?.completedStages,
      });

      if (switched || modelArrived) {
        this.isReturning = switched && !!ws?.knowledgeModel;
        this.runAnimations();
      } else if (processingStarted) {
        this.runInfoCardAnimation();
      }
      this.cdr.detectChanges();
    });

    this.stagesSub = this.manager.activeStages$.subscribe(() => {
      // Update status cycling — start/stop per stage
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
    this.runAnimations();

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
    this.knowledge
      .process('repository', entries, {
        workspaceId: id,
        repositoryId: ws?.repositoryId ?? undefined,
        repositoryPath: folderPath,
        workspaceName: profile.files[0]?.name,
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
    const EXT_TO_LANGUAGE: Record<string, string> = {
      cs: 'C#',
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      html: 'HTML',
      htm: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'Less',
      sql: 'SQL',
      py: 'Python',
      json: 'JSON',
      xml: 'XML',
      md: 'Markdown',
      txt: 'Plain Text',
      sh: 'Shell',
      bash: 'Shell',
      yml: 'YAML',
      yaml: 'YAML',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      kt: 'Kotlin',
      swift: 'Swift',
      rb: 'Ruby',
      php: 'PHP',
      cpp: 'C++',
      c: 'C',
      h: 'C/C++ Header',
      hpp: 'C++ Header',
    };
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
    this.showIdentity = false;
    this.showInfoCards = false;
    this.showArcDraw = false;
    this.showMetricCards = false;
    this.cdr.detectChanges();

    const fast = this.isReturning;
    const t = (ms: number) => (fast ? Math.round(ms * 0.4) : ms);
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showIdentity = true; }, t(80));
    run(() => { this.showInfoCards = true; }, t(220));
    run(() => { this.showArcDraw = true; }, t(320));
    this.animTimer = run(() => { this.showMetricCards = true; }, t(380));
  }

  private runInfoCardAnimation(): void {
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showInfoCards = true; }, 150);
    run(() => { this.showArcDraw = true; }, 280);
  }

  // ── Workspace actions ──────────────────────────────────────────────────────

  reanalyze(): void {
    const obs = this.knowledge.reanalyze(this.workspace!.id);
    if (obs) obs.subscribe({ error: () => {} });
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

  get projectCount(): number {
    return this.model?.structure.projects?.length ?? 0;
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

  get pipelineStages(): { label: string; stage: AIStage; state: 'complete' | 'failed' | 'running' | 'pending' }[] {
    const ai = this.model?.ai;
    const running = this.manager.getActiveStages(this.workspace?.id ?? '');
    const stages: AIStage[] = ['understanding', 'security', 'recommendations', 'learningPath'];
    return stages.map(s => {
      const label = STAGE_LABELS[s] ?? s;
      if (ai?.failedStages?.includes(s)) return { label, stage: s, state: 'failed' as const };
      if (ai?.completedStages?.includes(s)) return { label, stage: s, state: 'complete' as const };
      if (running.has(s)) return { label, stage: s, state: 'running' as const };
      return { label, stage: s, state: 'pending' as const };
    });
  }

  // ── Identity metrics ─────────────────────────────────────────

  get identityMetrics(): { label: string; value: string }[] {
    if (!this.model) return [];
    const primaryLang = this.model.structure.languages?.[0] ?? '—';
    const architecture = this.model.relationships.architecture?.patterns?.[0]?.name ?? '—';
    return [
      { label: 'Primary Language', value: primaryLang },
      { label: 'Files', value: String(this.fileCount) },
      { label: 'Architecture', value: architecture },
    ];
  }

  // ── Detected role tags ─────────────────────────────────────────

  get detectedRoleTags(): string[] {
    const u = this.model?.ai?.understanding;
    const patterns = this.model?.relationships.architecture?.patterns ?? [];
    const techs = this.model?.structure.technologies ?? [];
    const tags: string[] = [];
    if (patterns[0]?.name) tags.push(patterns[0].name);
    if (techs[0]?.technology && techs[0].technology !== patterns[0]?.name) {
      tags.push(techs[0].technology);
    }
    const cap = u?.coreCapabilities?.[0]?.name;
    if (cap && !tags.includes(cap)) tags.push(cap);
    return tags.slice(0, 3);
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
    const u = this.model?.ai?.understanding;
    if (!u) return '';

    const parts: string[] = [];

    // File count + primary language/tech
    const fileCount = this.model?.structure.totalFiles;
    const lang = this.model?.structure.languages?.[0];
    const tech = this.model?.structure.technologies?.[0]?.technology;
    if (fileCount && lang) parts.push(`${fileCount} files · ${tech ? tech : lang}`);
    else if (fileCount) parts.push(`${fileCount} files`);

    // Architecture pattern
    const pattern = this.model?.relationships.architecture?.patterns?.[0]?.name;
    if (pattern) parts.push(pattern);

    // Business criticality if notable
    if (u.businessCriticality === 'Critical' || u.businessCriticality === 'High') {
      parts.push(`${u.businessCriticality.toLowerCase()} criticality`);
    }

    // Security signal
    const sec = this.model?.ai?.security;
    if (sec && (sec.overallRisk === 'critical' || sec.overallRisk === 'high')) {
      const critCount = sec.findings.filter(f => f.severity === 'critical').length;
      const highCount = sec.findings.filter(f => f.severity === 'high').length;
      const label = critCount > 0 ? `${critCount} critical finding${critCount > 1 ? 's' : ''}` : `${highCount} high finding${highCount > 1 ? 's' : ''}`;
      parts.push(label);
    }

    // Debt hotspots if any
    const hotspotCount = u.technicalDebtHotspots?.length ?? 0;
    if (hotspotCount > 0 && !parts.some(p => p.includes('finding'))) {
      parts.push(`${hotspotCount} debt hotspot${hotspotCount > 1 ? 's' : ''}`);
    }

    return parts.length ? parts.join(' · ') : (u.executiveSummary ?? '');
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
        label: 'Dependencies & Relations',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('dependencyResolution'),
      },
      {
        id: 'security',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        count: ai?.security?.findings?.length ?? null,
        label: 'Security Issues',
        route: `${base}/security`,
        suggested: suggested === 'security',
        pending: !ai?.completedStages?.includes('security'),
      },
      {
        id: 'recommendations',
        icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
        count: ai?.recommendations?.recommendations?.length ?? null,
        label: 'Recommendations',
        route: `${base}/code-recommendations`,
        suggested: suggested === 'recommendations',
        pending: !ai?.completedStages?.includes('recommendations'),
      },
      {
        id: 'architecture',
        icon: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
        count: this.model?.relationships.architecture?.patterns.length ?? null,
        label: 'Arch Patterns',
        route: `${base}/architecture`,
        suggested: false,
        pending: !this.model?.capabilities.includes('architectureDiscovery'),
      },
      {
        id: 'key-areas',
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        count: null,
        tags: ai?.understanding?.coreCapabilities?.slice(0, 2).map((c) => c.name),
        label: 'Key Areas',
        route: `${base}/system-understanding`,
        suggested: suggested === 'understanding',
        pending: !ai?.completedStages?.includes('understanding'),
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
