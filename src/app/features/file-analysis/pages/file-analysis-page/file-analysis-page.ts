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

export interface HubMetricCard {
  id:        string;
  icon:      string;
  count:     number | null;
  label:     string;
  route:     string;
  suggested: boolean;
  pending:   boolean;
}

export type HealthTier = 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown';

const STAGE_LABELS: Record<AIStage, string> = {
  understanding:   'Understanding',
  security:        'Security',
  recommendations: 'Recommendations',
  learningPath:    'Learning Path',
  documentation:   'Documentation',
};

@Component({
  selector: 'app-file-analysis-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal],
  templateUrl: './file-analysis-page.html',
  styleUrl:    './file-analysis-page.scss',
})
export class FileAnalysisPage implements OnInit, OnDestroy {

  workspace:           Workspace | null      = null;
  model:               KnowledgeModel | null = null;
  showSwitcher         = false;
  switcherLimitReached = false;

  showIdentity    = false;
  showInfoCards   = false;
  showMetricCards = false;
  showSuggested   = false;

  uploadError: string | null = null;
  isDragging  = false;

  private sub:       Subscription | null = null;
  private limitSub:  Subscription | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly manager:   WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly router:    Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      const prevId    = this.workspace?.id;
      const prevModel = this.workspace?.knowledgeModel;
      this.workspace  = ws;
      this.model      = ws?.knowledgeModel ?? null;

      const switched      = prevId !== ws?.id;
      const modelArrived  = !prevModel && !!ws?.knowledgeModel;
      if (switched || modelArrived) this.runAnimations();
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());
    this.runAnimations();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.limitSub?.unsubscribe();
    if (this.animTimer) clearTimeout(this.animTimer);
  }

  // ── Animation sequence ─────────────────────────────────────────

  private runAnimations(): void {
    if (this.animTimer) clearTimeout(this.animTimer);
    this.showIdentity    = false;
    this.showInfoCards   = false;
    this.showMetricCards = false;
    this.showSuggested   = false;

    setTimeout(() => { this.showIdentity    = true; },  80);
    setTimeout(() => { this.showInfoCards   = true; }, 220);
    setTimeout(() => { this.showMetricCards = true; }, 380);
    this.animTimer = setTimeout(() => { this.showSuggested = true; }, 560);
  }

  // ── Upload ────────────────────────────────────────────────────

  browse(): void {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.ts,.js,.tsx,.jsx,.py,.java,.cs,.go,.rs,.cpp,.c,.h,.rb,.php,.swift,.kt,.html,.css,.scss,.json,.yaml,.yml,.xml,.md';
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
      this.uploadError = 'File analysis supports one file at a time. For multiple files, try Folder Analysis.';
      return;
    }

    const file = files[0];
    if (file.size === 0 && !file.type) {
      this.uploadError = 'That looks like a folder. Use Folder Analysis to analyze a whole directory.';
      return;
    }

    const id = this.manager.activeId;
    if (!id) return;

    this.manager.rename(id, file.name);
    this.fileToEntry(file).then(entry => {
      this.knowledge.process('file', [entry], {
        workspaceId:   id,
        workspaceName: file.name,
        persist:       false,
      }).subscribe({ error: () => {} });
    });
  }

  private fileToEntry(file: File): Promise<ElectronDirectoryEntry> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve({ name: file.name, relativePath: file.name, content: reader.result as string, size: file.size, modifiedAt: new Date(file.lastModified).toISOString() });
      reader.onerror = () => resolve({ name: file.name, relativePath: file.name, content: null, size: file.size, modifiedAt: new Date(file.lastModified).toISOString() });
      reader.readAsText(file);
    });
  }

  // ── Workspace actions ────────────────────────────────────────

  reanalyze(): void {
    const obs = this.knowledge.reanalyze(this.workspace!.id);
    if (obs) obs.subscribe({ error: () => {} });
  }

  newWorkspace(): void {
    if (!this.manager.canCreate()) { this.openSwitcher(); return; }
    this.manager.create('file');
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
    const lang    = (this.model.structure.fileLanguage ?? '').toLowerCase();
    if (!symbols?.type || symbols.type === '') {
      if (lang === 'typescript' || lang === 'javascript') {
        if (symbols?.classes.some(c => c.toLowerCase().includes('service')))   return 'Service';
        if (symbols?.classes.some(c => c.toLowerCase().includes('component'))) return 'Component';
        if (symbols?.classes.some(c => c.toLowerCase().includes('guard')))     return 'Guard';
        if (symbols?.classes.some(c => c.toLowerCase().includes('pipe')))      return 'Pipe';
      }
      if (symbols?.exports.length && !symbols?.classes.length) return 'Utility';
      return 'Source File';
    }
    return symbols.type;
  }

  get language(): string {
    return this.model?.structure.fileLanguage ?? this.model?.structure.languages[0] ?? '';
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

  get canReanalyze(): boolean {
    return this.knowledge.canReanalyze(this.workspace?.id ?? '') && !this.isAnalyzing;
  }

  get workspaceList(): Workspace[] {
    return this.manager.workspaces;
  }

  // ── Code Health ────────────────────────────────────────────────

  get healthTier(): HealthTier {
    if (!this.model) return 'unknown';
    const c   = this.model.insights.complexity;
    const m   = this.model.insights.maintainability;
    const crit = this.model.ai?.security?.findings?.filter(f => f.severity === 'critical' || f.severity === 'high').length ?? 0;

    if (c === 'High' || m === 'Low' || crit >= 3) return 'critical';
    if (c === 'Low' && m === 'High' && crit === 0) return 'healthy';
    if (c === 'Medium' || m === 'Medium') return 'fair';
    return 'needs-attention';
  }

  get healthLabel(): string {
    const map: Record<HealthTier, string> = {
      healthy: 'Healthy', fair: 'Fair', 'needs-attention': 'Needs Attention', critical: 'Critical', unknown: 'Pending',
    };
    return map[this.healthTier];
  }

  get complexityLabel(): string      { return this.model?.insights.complexity      ?? '—'; }
  get maintainabilityLabel(): string { return this.model?.insights.maintainability ?? '—'; }

  get securityHealthLabel(): string {
    const findings = this.model?.ai?.security?.findings ?? [];
    if (findings.some(f => f.severity === 'critical')) return 'Critical';
    if (findings.some(f => f.severity === 'high'))     return 'High Risk';
    return 'Good';
  }

  // ── Pipeline stage dots ────────────────────────────────────────

  get pipelineStages(): { label: string; state: 'complete' | 'failed' | 'running' | 'pending' }[] {
    const ai      = this.model?.ai;
    const running = this.manager.getActiveStages(this.workspace?.id ?? '');
    const stages: AIStage[] = ['understanding', 'security', 'recommendations', 'learningPath', 'documentation'];

    const scanState  = this.model ? 'complete' : (this.isAnalyzing ? 'running' : 'pending');
    const parseState = this.model ? 'complete' : (this.isAnalyzing ? 'running' : 'pending');

    return [
      { label: 'Scan',  state: scanState  as 'complete' | 'failed' | 'running' | 'pending' },
      { label: 'Parse', state: parseState as 'complete' | 'failed' | 'running' | 'pending' },
      ...stages.map(s => {
        if (!this.model)                           return { label: STAGE_LABELS[s], state: 'pending'  as const };
        if (running.has(s))                        return { label: STAGE_LABELS[s], state: 'running'  as const };
        if (ai?.completedStages?.includes(s))      return { label: STAGE_LABELS[s], state: 'complete' as const };
        if (ai?.failedStages?.includes(s))         return { label: STAGE_LABELS[s], state: 'failed'   as const };
        return { label: STAGE_LABELS[s], state: 'pending' as const };
      }),
    ];
  }

  // ── Metric cards ───────────────────────────────────────────────

  get metricCards(): HubMetricCard[] {
    const ai       = this.model?.ai;
    const base     = '/file-analysis';
    const suggested = this.suggestedRoute;

    return [
      {
        id:        'understanding',
        icon:      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
        count:     null,
        label:     'Understanding',
        route:     `${base}/system-understanding`,
        suggested: suggested === 'understanding',
        pending:   !ai?.completedStages?.includes('understanding'),
      },
      {
        id:        'security',
        icon:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        count:     ai?.security?.findings?.length ?? null,
        label:     'Security Issues',
        route:     `${base}/security`,
        suggested: suggested === 'security',
        pending:   !ai?.completedStages?.includes('security'),
      },
      {
        id:        'recommendations',
        icon:      'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
        count:     ai?.recommendations?.recommendations?.length ?? null,
        label:     'Recommendations',
        route:     `${base}/code-recommendations`,
        suggested: suggested === 'recommendations',
        pending:   !ai?.completedStages?.includes('recommendations'),
      },
      {
        id:        'dataflow',
        icon:      'M22 12H18L15 21 9 3 6 12 2 12',
        count:     this.model?.insights.dataFlow?.steps?.length ?? null,
        label:     'Flow Steps',
        route:     `${base}/data-flow`,
        suggested: false,
        pending:   !this.model?.capabilities.includes('insightExtraction'),
      },
      {
        id:        'symbols',
        icon:      'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        count:     this.symbolCount,
        label:     'Key Symbols',
        route:     `${base}/architecture`,
        suggested: false,
        pending:   !this.model?.capabilities.includes('symbolExtraction'),
      },
    ];
  }

  private get suggestedRoute(): string {
    const findings  = this.model?.ai?.security?.findings ?? [];
    const critical  = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    const recCount  = this.model?.ai?.recommendations?.recommendations?.length ?? 0;

    if (critical > 0)   return 'security';
    if (findings.length > 0) return 'security';
    if (recCount > 3)   return 'recommendations';
    return 'understanding';
  }

  private get symbolCount(): number | null {
    if (!this.model) return null;
    const sym = Object.values(this.model.structure.symbols)[0];
    if (!sym) return null;
    return sym.classes.length + sym.methods.length;
  }
}
