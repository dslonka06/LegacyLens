import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import {
  TargetValidationService,
  ValidationResult,
  AnalysisTarget,
} from '@app/core/services/target-validation.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { PendingRepositoryService } from '@app/core/services/pending-repository.service';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { ElectronDirectoryEntry } from '../../../../../electron';
import { hashContent } from '@app/core/utils/hash';

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

const STAGE_LABELS: Record<AIStage, string> = {
  understanding: 'Understanding',
  security: 'Security',
  recommendations: 'Recommendations',
  learningPath: 'Learning Path',
  documentation: 'Documentation',
};

@Component({
  selector: 'app-repository-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ValidationDialog],
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

  // Electron / repo loading state
  isScanning = false;
  scanFileCount = 0;
  validationResult: ValidationResult | null = null;

  private pendingValidationPath: string | null = null;
  private scanProgressUnsub: (() => void) | null = null;
  private sub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly pendingRepo: PendingRepositoryService,
    private readonly electronService: ElectronService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly targetValidation: TargetValidationService,
    private readonly layoutService: PanelLayoutService,
    private readonly zone: NgZone,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prevId = this.workspace?.id;
      const prevModel = this.workspace?.knowledgeModel;
      this.workspace = ws;
      this.model = ws?.knowledgeModel ?? null;

      const switched = prevId !== ws?.id;
      const modelArrived = !prevModel && !!ws?.knowledgeModel;
      if (switched || modelArrived) {
        this.isReturning = switched && !!ws?.knowledgeModel;
        this.runAnimations();
      }
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());
    this.runAnimations();

    // Consume the pending repository path set by the home page library
    const pending = this.pendingRepo.consume();
    if (pending) {
      const id = this.manager.activeId;
      if (id) this.manager.setRepositoryId(id, pending.repositoryId);
      this.loadFromPath(pending.path);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.limitSub?.unsubscribe();
    this.scanProgressUnsub?.();
    if (this.animTimer) clearTimeout(this.animTimer);
  }

  // ── Repo loading (Electron IPC) ────────────────────────────────────────────

  private async loadFromPath(folderPath: string): Promise<void> {
    const validation = await this.targetValidation.validate(folderPath, 'repository');
    if (!validation.valid && validation.mismatch) {
      this.pendingValidationPath = folderPath;
      this.validationResult = validation;
      return;
    }
    if (!validation.valid) return;

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

    const fast = this.isReturning;
    const t = (ms: number) => (fast ? Math.round(ms * 0.4) : ms);

    setTimeout(() => { this.showIdentity = true; }, t(80));
    setTimeout(() => { this.showInfoCards = true; }, t(220));
    setTimeout(() => { this.showArcDraw = true; }, t(320));
    this.animTimer = setTimeout(() => { this.showMetricCards = true; }, t(380));
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

  goToHome(): void {
    this.router.navigate(['/']);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
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

  get canReanalyze(): boolean {
    return this.knowledge.canReanalyze(this.workspace?.id ?? '') && !this.isAnalyzing;
  }

  get workspaceList(): Workspace[] {
    return this.manager.workspaces;
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
    return tree.children
      .slice(0, 6)
      .map((f) => ({ name: f.name, fileCount: f.totalFileCount }))
      .filter((s) => s.fileCount > 0);
  }

  // ── Code Health ────────────────────────────────────────────────────────────

  get healthTier(): HealthTier {
    if (!this.model) return 'unknown';
    const c = this.model.insights.complexity;
    const m = this.model.insights.maintainability;
    const crit =
      this.model.ai?.security?.findings?.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      ).length ?? 0;

    if (c === 'High' || m === 'Low' || crit >= 3) return 'critical';
    if (c === 'Low' && m === 'High' && crit === 0) return 'healthy';
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

  get securityRiskCount(): number {
    return (
      this.model?.ai?.security?.findings?.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      ).length ?? 0
    );
  }

  // ── Pipeline stages ────────────────────────────────────────────────────────

  get pipelineStages(): { label: string; state: 'complete' | 'failed' | 'running' | 'pending' }[] {
    const ai = this.model?.ai;
    const running = this.manager.getActiveStages(this.workspace?.id ?? '');
    const stages: AIStage[] = [
      'understanding',
      'security',
      'recommendations',
      'learningPath',
      'documentation',
    ];

    const scanState = this.model
      ? 'complete'
      : this.isAnalyzing || this.isScanning
        ? 'running'
        : 'pending';
    const parseState = this.model ? 'complete' : this.isAnalyzing ? 'running' : 'pending';

    return [
      {
        label: this.isScanning ? `Scanning (${this.scanFileCount})` : 'Scan',
        state: scanState as 'complete' | 'failed' | 'running' | 'pending',
      },
      { label: 'Parse', state: parseState as 'complete' | 'failed' | 'running' | 'pending' },
      ...stages.map((s) => {
        if (!this.model) return { label: STAGE_LABELS[s], state: 'pending' as const };
        if (running.has(s)) return { label: STAGE_LABELS[s], state: 'running' as const };
        if (ai?.completedStages?.includes(s))
          return { label: STAGE_LABELS[s], state: 'complete' as const };
        if (ai?.failedStages?.includes(s))
          return { label: STAGE_LABELS[s], state: 'failed' as const };
        return { label: STAGE_LABELS[s], state: 'pending' as const };
      }),
    ];
  }

  // ── Metric cards ───────────────────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai = this.model?.ai;
    const base = '/repository-analysis';
    const suggested = this.suggestedRoute;

    return [
      {
        id: 'understanding',
        icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
        count: null,
        tags: ai?.understanding?.coreCapabilities?.slice(0, 2).map((c) => c.name),
        label: 'Understanding',
        route: `${base}/system-understanding`,
        suggested: suggested === 'understanding',
        pending: !ai?.completedStages?.includes('understanding'),
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
        id: 'dependencies',
        icon: 'M22 12H18L15 21 9 3 6 12 2 12',
        count: this.dependencyCount > 0 ? this.dependencyCount : null,
        label: 'Dependencies',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('dependencyResolution'),
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
