import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { Workspace, WorkspaceStatus } from '@app/workspace/models/workspace-entity.model';
import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { LLMSummaryKey } from '@app/knowledge/models/llm-summaries.model';
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
  subtitle?: string;
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
  showHealthInfo = false;
  showMetricCards = false;
  isReturning = false;

  // Pipeline cycling status text per stage
  pipelineStatusText: Record<string, string> = {};
  private statusTimers: Record<string, ReturnType<typeof setInterval>> = {};

  // Animated count display — counts up from 0 to actual value when cards appear
  displayedCounts: Record<string, number | undefined> = {};

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
    private readonly electron: ElectronService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    const boot = this.manager.getActive();
    if (boot) {
      this.workspace = boot;
      this.model = boot.knowledgeModel ?? null;
      if (boot.knowledgeModel) {
        this.showIdentity = true;
        this.showInfoCards = true;
        this.showArcDraw = true;
        this.showMetricCards = true;
        this.animateCountsTo(this.metricCards);
      } else {
        this.runAnimations();
      }
      this.cdr.detectChanges();
    }

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prevId = this.workspace?.id;
      const prevStatus = this.workspace?.status;
      const prevModel = this.workspace?.knowledgeModel;
      const prevAi = this.workspace?.knowledgeModel?.ai;
      this.workspace = ws;
      this.model = ws?.knowledgeModel ?? null;

      const sameAsBootstrap = prevId === ws?.id && prevModel === ws?.knowledgeModel;
      if (sameAsBootstrap) {
        this.cdr.detectChanges();
        return;
      }

      const switched = prevId !== ws?.id;
      const modelArrived = !prevModel && !!ws?.knowledgeModel;
      const processingStarted = prevStatus !== 'processing' && ws?.status === 'processing';
      const aiUpdated = !switched && !modelArrived && !!ws?.knowledgeModel &&
        ws.knowledgeModel.ai !== prevAi;

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
    });

    this.stagesSub = this.manager.activeStages$.subscribe((stagesMap) => {
      const stages: AIStage[] = ['understanding', 'dataFlow', 'security', 'recommendations', 'learningPath'];
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

    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showIdentity = true; }, 80);
    run(() => { this.showInfoCards = true; }, 220);
    run(() => { this.showArcDraw = true; }, 320);
    this.animTimer = run(() => { this.showMetricCards = true; }, 380);
  }

  // Slide info row in as soon as processing begins, before model arrives
  private runInfoCardAnimation(): void {
    const run = (fn: () => void, delay: number) =>
      setTimeout(() => this.zone.run(() => { fn(); this.cdr.detectChanges(); }), delay);

    run(() => { this.showIdentity = true; }, 80);
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
    if (this.filePath) this.manager.setPath(id, this.filePath);
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
    const ws = this.workspace;
    if (!ws) return;

    // Hot path: cache still warm from this session
    const obs = this.knowledge.reanalyze(ws.id);
    if (obs) { obs.subscribe({ error: () => {} }); return; }

    // Cold path: app was reloaded — re-read the file from disk using the stored path
    const path = ws.path;
    if (!path) return;
    const name = ws.name;

    this.electron.readFile(path).then((content) => {
      const entry: ElectronDirectoryEntry = {
        name,
        relativePath: name,
        content: content ?? null,
        size: 0,
        modifiedAt: new Date().toISOString(),
      };
      this.knowledge.process('file', [entry], {
        workspaceId: ws.id,
        workspaceName: name,
        persist: false,
      }).subscribe({ error: () => {} });
    });
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

  switchWorkspace(id: string): void {
    this.manager.activate(id);
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
    const summaryKeys: LLMSummaryKey[] = ['understanding', 'dataFlow', 'security', 'recommendations', 'learningPath'];
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
      { key: 'dataFlow',        label: 'Data Flow',       state: summaryState('dataFlow') },
      { key: 'security',        label: 'Security',        state: summaryState('security') },
      { key: 'recommendations', label: 'Recommendations', state: summaryState('recommendations') },
      { key: 'learningPath',    label: 'Learning Path',   state: summaryState('learningPath') },
    ];
  }

  // ── Detected role tags ─────────────────────────────────────────

  get detectedRoleTags(): string[] {
    const lang = this.model?.structure.fileLanguage ?? this.model?.structure.languages?.[0];
    const techs = (this.model?.structure.technologies ?? []).map((t: any) => t.technology ?? t);
    const combined = [...new Set([...(lang ? [lang] : []), ...techs])];
    return combined.filter(Boolean).slice(0, 5);
  }

  // ── AI analysis statistics ─────────────────────────────────────

  get aiStats(): { label: string; value: string }[] {
    const ai = this.model?.ai;
    if (!ai) return [];
    const sym = Object.values(this.model?.structure.symbols ?? {})[0];
    const symbolCount = sym ? sym.classes.length + sym.methods.length : 0;
    const importCount = sym ? sym.imports.length : 0;
    const findingCount = ai.security?.findings?.length ?? 0;
    return [
      { label: 'Symbols analyzed', value: String(symbolCount) },
      { label: 'Dependencies mapped', value: String(importCount) },
      { label: 'Findings generated', value: String(findingCount) },
    ];
  }

  // ── Metric cards ───────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai = this.model?.ai;
    const base = '/file-analysis';
    const suggested = this.suggestedRoute;

    const importCount = this.importCount !== '—' ? Number(this.importCount) : 0;
    const refBy = this.referencedByCount;
    const secCount = ai?.security?.findings?.length ?? 0;
    const recCount = ai?.recommendations?.recommendations?.length ?? 0;
    const flowSteps = this.model?.insights.dataFlow?.steps?.length ?? 0;
    const syms = this.symbolTotal;

    return [
      {
        id: 'dependencies',
        icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
        count: importCount + refBy,
        subtitle: 'Dependencies & Relations',
        label: 'Dependencies & Relations',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('fileParsing'),
      },
      {
        id: 'security',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        count: secCount,
        subtitle: 'Security Issues',
        label: 'Security',
        route: `${base}/security`,
        suggested: suggested === 'security',
        pending: !ai?.completedStages?.includes('security'),
      },
      {
        id: 'recommendations',
        icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
        count: recCount,
        subtitle: 'Recommendations',
        label: 'Recommendations',
        route: `${base}/code-recommendations`,
        suggested: suggested === 'recommendations',
        pending: !ai?.completedStages?.includes('recommendations'),
      },
      {
        id: 'dataflow',
        icon: 'M22 12H18L15 21 9 3 6 12 2 12',
        count: flowSteps,
        subtitle: 'Data Flow Steps',
        label: 'Data Flow',
        route: `${base}/data-flow`,
        suggested: false,
        pending: !this.model?.capabilities.includes('fileParsing'),
      },
      {
        id: 'symbols',
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        count: syms ?? 0,
        subtitle: 'Key Symbols',
        label: 'Key Symbols',
        route: `${base}/system-understanding`,
        suggested: false,
        pending: !this.model?.capabilities.includes('symbolExtraction'),
      },
      {
        id: 'learning',
        icon: 'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
        count: null,
        subtitle: 'Personalized roadmap for this file',
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

  // ── Identity metrics ─────────────────────────────────────────

  private get lineCount(): string {
    const src = this.model?.structure.sourceCode;
    if (!src) return '—';
    return String(src.split('\n').length);
  }

  private get importCount(): string {
    if (!this.model) return '—';
    const sym = Object.values(this.model.structure.symbols)[0];
    if (!sym) return '—';
    return String(sym.imports.length);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private get fileSize(): string {
    const src = this.model?.structure.sourceCode;
    if (!src) return '—';
    return this.formatBytes(new TextEncoder().encode(src).length);
  }


  private get symbolTotal(): number | null {
    if (!this.model) return null;
    const sym = Object.values(this.model.structure.symbols)[0];
    if (!sym) return null;
    return sym.classes.length + sym.methods.length + sym.exports.length;
  }

  private get referencedByCount(): number {
    const filePath = this.model?.structure.filePath;
    if (!filePath) return 0;
    const graph = this.model?.relationships.dependencies?.graph;
    if (!graph) return 0;
    const fileName = filePath.split(/[\\/]/).pop() ?? '';
    const node = graph.nodes.find(n => n.name === fileName || n.id === filePath);
    if (!node) return 0;
    return graph.edges.filter(e => e.target === node.id).length;
  }

  get identityMetrics(): { label: string; value: string }[] {
    if (!this.model) return [];
    return [
      { label: 'Language', value: this.language || '—' },
      { label: 'Size', value: this.fileSize },
      { label: 'Lines', value: this.lineCount },
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
}
