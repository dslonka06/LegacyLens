import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { ElectronDirectoryEntry } from '../../../../../electron';
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
  selector: 'app-folder-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ThemeToggle],
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

  // Pipeline cycling status text per stage
  pipelineStatusText: Record<string, string> = {};
  private statusTimers: Record<string, ReturnType<typeof setInterval>> = {};

  // Animated count display — counts up from 0 to actual value when cards appear
  displayedCounts: Record<string, number> = {};

  uploadError: string | null = null;
  isDragging = false;

  private sub: Subscription | null = null;
  private stagesSub: Subscription | null = null;
  private limitSub: Subscription | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
  private countTimers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    const init = this.manager.getActive();
    this.workspace = init ?? null;
    this.model = init?.knowledgeModel ?? null;
    // Returning to an existing analysis — use fast animation variant
    this.isReturning = !!init?.knowledgeModel;

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

      if (switched || modelArrived) {
        this.isReturning = switched && !!ws?.knowledgeModel;
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
      const stages: AIStage[] = ['understanding', 'security', 'recommendations', 'learningPath', 'architecture', 'dataFlow'];
      stages.forEach((stage) => {
        const running = this.manager.getActiveStages(this.workspace?.id ?? '').has(stage);
        const hasTimer = !!this.statusTimers[stage];
        if (running && !hasTimer) this.startStatusCycle(stage);
        else if (!running && hasTimer) this.stopStatusCycle(stage);
      });
      this.cdr.detectChanges();
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());
    this.runAnimations();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stagesSub?.unsubscribe();
    this.limitSub?.unsubscribe();
    if (this.animTimer) clearTimeout(this.animTimer);
    this.clearCountTimers();
    this.stopAllStatusCycles();
  }

  // ── Pipeline status cycling ─────────────────────────────────

  startStatusCycle(stage: AIStage): void {
    const messages = STAGE_MESSAGES[stage] ?? ['Processing...'];
    let idx = 0;
    this.pipelineStatusText[stage] = messages[0];
    this.statusTimers[stage] = setInterval(() => {
      idx = (idx + 1) % messages.length;
      this.pipelineStatusText[stage] = messages[idx];
      this.cdr.detectChanges();
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

  // ── Animation sequence ─────────────────────────────────────────

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
    // Double-rAF ensures the arc element is painted with dashoffset:283 before
    // --draw is applied, so the CSS transition has a "from" state to animate from.
    run(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.zone.run(() => { this.showArcDraw = true; this.cdr.detectChanges(); });
      }));
    }, t(220));
    this.animTimer = run(() => { this.showMetricCards = true; }, t(380));
  }

  private runInfoCardAnimation(): void {
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showInfoCards = true; }, 150);
    run(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.zone.run(() => { this.showArcDraw = true; this.cdr.detectChanges(); });
      }));
    }, 150);
  }

  private animateCountsTo(cards: HubMetricCard[]): void {
    this.clearCountTimers();
    for (const card of cards) {
      if (card.count === null || card.count === 0) {
        this.displayedCounts[card.id] = card.count ?? 0;
        continue;
      }
      const target = card.count;
      const duration = 600;
      const steps = Math.min(target, 30);
      const intervalMs = duration / steps;
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

  switchWorkspace(id: string): void {
    this.manager.activate(id);
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
      { key: 'security',        label: 'Security Review', state: summaryState('security') },
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
    const depCount = this.dependencyCount;
    const components = ai.understanding?.coreCapabilities?.length ?? 0;
    return [
      { label: 'Files analyzed', value: String(fileCount) },
      { label: 'Relationships mapped', value: String(depCount) },
      { label: 'Components detected', value: String(components) },
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
        pending: !this.model?.capabilities.includes('architectureDiscovery'),
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
