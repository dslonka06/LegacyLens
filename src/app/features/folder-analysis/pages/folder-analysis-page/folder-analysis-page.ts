import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { ElectronDirectoryEntry } from '../../../../../electron';

export type HealthTier = 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown';

export interface HubMetricCard {
  id: string;
  icon: string;
  count: number | null;
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
  selector: 'app-folder-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal],
  templateUrl: './folder-analysis-page.html',
  styleUrl: './folder-analysis-page.scss',
})
export class FolderAnalysisPage implements OnInit, OnDestroy {
  workspace: Workspace | null = null;
  model: KnowledgeModel | null = null;
  showSwitcher = false;
  switcherLimitReached = false;

  showIdentity = false;
  showInfoCards = false;
  showArcDraw = false;
  showMetricCards = false;
  isReturning = false;

  uploadError: string | null = null;
  isDragging = false;

  private sub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
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
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.limitSub?.unsubscribe();
    if (this.animTimer) clearTimeout(this.animTimer);
  }

  // ── Animation ──────────────────────────────────────────────────────────────

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

  // ── Upload ─────────────────────────────────────────────────────────────────

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
        .process('folder', entries, {
          workspaceId: id,
          workspaceName: folderName,
          persist: false,
        })
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
    this.manager.create('folder');
  }

  deleteWorkspace(): void {
    if (this.workspace) this.manager.delete(this.workspace.id);
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

  get folderName(): string {
    return this.workspace?.name ?? 'Untitled';
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

  // ── Folder metrics ─────────────────────────────────────────────────────────

  get fileCount(): number {
    return this.model?.structure.totalFiles ?? 0;
  }

  get subfolderCount(): number {
    return this.model?.structure.folderTree?.children.length ?? 0;
  }

  get languageList(): string {
    const langs = this.model?.structure.languages ?? [];
    return langs.length ? langs.slice(0, 4).join(', ') : '—';
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

  get primaryFrameworks(): string {
    const fw = this.model?.structure.frameworks ?? [];
    return fw.length ? fw.slice(0, 3).join(', ') : '—';
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

  // ── Pipeline stage dots ────────────────────────────────────────────────────

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

    const scanState = this.model ? 'complete' : this.isAnalyzing ? 'running' : 'pending';
    const parseState = this.model ? 'complete' : this.isAnalyzing ? 'running' : 'pending';

    return [
      { label: 'Scan', state: scanState as 'complete' | 'failed' | 'running' | 'pending' },
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
    const base = '/folder-analysis';
    const suggested = this.suggestedRoute;

    return [
      {
        id: 'understanding',
        icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
        count: null,
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
