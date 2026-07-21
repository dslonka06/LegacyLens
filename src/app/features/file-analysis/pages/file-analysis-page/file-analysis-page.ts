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

export type HealthTier = 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown';

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
  selector: 'app-file-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ThemeToggle],
  templateUrl: './file-analysis-page.html',
  styleUrl: './file-analysis-page.scss',
})
export class FileAnalysisPage implements OnInit, OnDestroy {
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

  // Animated count display — counts up from 0 to actual value when cards appear
  displayedCounts: Record<string, number> = {};

  uploadError: string | null = null;
  isDragging = false;
  filePath: string | null = null;

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
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prevId = this.workspace?.id;
      const prevStatus = this.workspace?.status;
      const prevModel = this.workspace?.knowledgeModel;
      const prevAi = this.workspace?.knowledgeModel?.ai;
      this.workspace = ws;
      this.model = ws?.knowledgeModel ?? null;

      const switched = prevId !== ws?.id;
      const modelArrived = !prevModel && !!ws?.knowledgeModel;
      // Also animate when processing begins so info row slides in
      const processingStarted = prevStatus !== 'processing' && ws?.status === 'processing';
      const aiUpdated = !switched && !modelArrived && !!ws?.knowledgeModel &&
        ws.knowledgeModel.ai !== prevAi;
      console.log('[Hub] ws update', {
        switched,
        modelArrived,
        aiUpdated,
        prevAiRef: prevAi ? 'has-prev' : 'null',
        newAiRef: ws?.knowledgeModel?.ai ? 'has-new' : 'null',
        prevAiSame: prevAi === ws?.knowledgeModel?.ai,
        completedStages: ws?.knowledgeModel?.ai?.completedStages,
        willAnimate: modelArrived || aiUpdated,
      });

      if (switched || modelArrived) {
        this.isReturning = switched && !!ws?.knowledgeModel;
        this.runAnimations();
      } else if (processingStarted) {
        this.runInfoCardAnimation();
      }

      if (modelArrived || aiUpdated) {
        console.log('[Hub] calling animateCountsTo, cards pending states:', this.metricCards.map(c => ({ id: c.id, pending: c.pending, count: c.count })));
        this.animateCountsTo(this.metricCards);
      }
    });

    // Re-render when stage running state changes so pipeline rows update live
    this.stagesSub = this.manager.activeStages$.subscribe((stagesMap) => {
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
    run(() => { this.showArcDraw = true; }, t(320));
    this.animTimer = run(() => { this.showMetricCards = true; }, t(380));
  }

  // Slide info row in as soon as processing begins, before model arrives
  private runInfoCardAnimation(): void {
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showInfoCards = true; }, 150);
    run(() => { this.showArcDraw = true; }, 280);
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

  // ── Upload ────────────────────────────────────────────────────

  browse(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.ts,.js,.tsx,.jsx,.py,.java,.cs,.go,.rs,.cpp,.c,.h,.rb,.php,.swift,.kt,.html,.css,.scss,.json,.yaml,.yml,.xml,.md';
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

    if (files.length > 1) {
      this.uploadError =
        'File analysis supports one file at a time. For multiple files, try Folder Analysis.';
      return;
    }

    const file = files[0];
    this.filePath = (file as any).path ?? null;
    if (file.size === 0 && !file.type) {
      this.uploadError =
        'That looks like a folder. Use Folder Analysis to analyze a whole directory.';
      return;
    }

    const id = this.manager.activeId;
    if (!id) return;

    this.manager.rename(id, file.name);
    this.fileToEntry(file).then((entry) => {
      this.knowledge
        .process('file', [entry], {
          workspaceId: id,
          workspaceName: file.name,
          persist: false,
        })
        .subscribe({ error: () => {} });
    });
  }

  private fileToEntry(file: File): Promise<ElectronDirectoryEntry> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          relativePath: file.name,
          content: reader.result as string,
          size: file.size,
          modifiedAt: new Date(file.lastModified).toISOString(),
        });
      reader.onerror = () =>
        resolve({
          name: file.name,
          relativePath: file.name,
          content: null,
          size: file.size,
          modifiedAt: new Date(file.lastModified).toISOString(),
        });
      reader.readAsText(file);
    });
  }

  // ── Workspace actions ────────────────────────────────────────

  reanalyze(): void {
    const obs = this.knowledge.reanalyze(this.workspace!.id);
    if (obs) obs.subscribe({ error: () => {} });
  }

  newWorkspace(): void {
    if (!this.manager.canCreate()) {
      this.openSwitcher();
      return;
    }
    this.manager.create('file');
  }

  deleteWorkspace(): void {
    if (this.workspace) this.manager.delete(this.workspace.id);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
  }

  goToLibrary(): void {
    this.router.navigate(['/library'], { queryParams: { type: 'file' } });
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

  get fileName(): string {
    return this.workspace?.name ?? 'Untitled';
  }

  get detectedKind(): string {
    if (!this.model) return '';
    const symbols = Object.values(this.model.structure.symbols)[0];
    const lang = (this.model.structure.fileLanguage ?? '').toLowerCase();
    if (!symbols?.type || symbols.type === '') {
      if (lang === 'typescript' || lang === 'javascript') {
        if (symbols?.classes.some((c) => c.toLowerCase().includes('service'))) return 'Service';
        if (symbols?.classes.some((c) => c.toLowerCase().includes('component'))) return 'Component';
        if (symbols?.classes.some((c) => c.toLowerCase().includes('guard'))) return 'Guard';
        if (symbols?.classes.some((c) => c.toLowerCase().includes('pipe'))) return 'Pipe';
      }
      if (symbols?.exports.length && !symbols?.classes.length) return 'Utility';
      return 'Source File';
    }
    // "Repository" is a design pattern name from the legacy analysis engine — remap to
    // something that reads as a file type rather than a workspace/analysis type.
    if (symbols.type === 'Repository') return 'Data Access';
    return symbols.type;
  }

  get language(): string {
    return this.model?.structure.fileLanguage ?? this.model?.structure.languages[0] ?? '';
  }

  get fileExt(): string {
    const name = this.fileName;
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toUpperCase() : '';
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

  // ── Code Health ────────────────────────────────────────────────

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

  // ── Metric cards ───────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai = this.model?.ai;
    const base = '/file-analysis';
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
        id: 'dataflow',
        icon: 'M22 12H18L15 21 9 3 6 12 2 12',
        count: this.model?.insights.dataFlow?.steps?.length ?? null,
        label: 'Flow Steps',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('fileParsing'),
      },
      {
        id: 'symbols',
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        count: this.symbolCount,
        label: 'Key Symbols',
        route: `${base}/architecture`,
        suggested: false,
        pending: !this.model?.capabilities.includes('symbolExtraction'),
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

  private get symbolCount(): number | null {
    if (!this.model) return null;
    const sym = Object.values(this.model.structure.symbols)[0];
    if (!sym) return null;
    return sym.classes.length + sym.methods.length;
  }

  // ── Identity metrics ─────────────────────────────────────────

  get identityMetrics(): { label: string; value: string }[] {
    if (!this.model) return [];
    return [
      { label: 'Language', value: this.language || '—' },
      { label: 'File Type', value: this.detectedKind || '—' },
      { label: 'Symbols', value: this.symbolCount !== null ? String(this.symbolCount) : '—' },
    ];
  }

  get executiveSummary(): string {
    return this.model?.ai?.understanding?.executiveSummary ?? '';
  }
}
