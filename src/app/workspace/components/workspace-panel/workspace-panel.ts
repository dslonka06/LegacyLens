import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Workspace, WorkspaceStatus, WorkspaceType } from '@app/workspace/models/workspace-entity.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { ExportService } from '@app/analysis/services/export.service';
import type { AIStage } from '@app/knowledge/models/knowledge-model.contract';

const STAGE_LABELS: Record<AIStage, string> = {
  understanding:   'Understanding',
  security:        'Security',
  recommendations: 'Recommendations',
  learningPath:    'Learning Path',
  documentation:   'Documentation',
};

@Component({
  selector: 'app-workspace-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace-panel.html',
  styleUrl: './workspace-panel.scss',
})
export class WorkspacePanel implements OnInit, OnDestroy {

  @Output() switchRequested = new EventEmitter<void>();

  workspace: Workspace | null = null;
  renaming = false;
  renameValue = '';
  activeStageLabels: string[] = [];

  private sub: Subscription | null = null;

  isExporting = false;

  constructor(
    private readonly manager:    WorkspaceManagerService,
    private readonly knowledge:  WorkspaceKnowledgeService,
    private readonly exportSvc:  ExportService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([
      this.manager.activeWorkspace$,
      this.manager.activeStages$,
    ]).pipe(
      map(([ws, stages]) => ({ ws, stages })),
    ).subscribe(({ ws, stages }) => {
      this.workspace = ws;
      if (ws) {
        const running = stages.get(ws.id) ?? new Set();
        this.activeStageLabels = [...running].map(s => STAGE_LABELS[s] ?? s);
      } else {
        this.activeStageLabels = [];
      }
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── Actions ───────────────────────────────────────────────────────────────

  openSwitcher(): void {
    this.switchRequested.emit();
  }

  newWorkspace(): void {
    if (!this.workspace) return;
    if (!this.manager.canCreate()) {
      this.switchRequested.emit();
      return;
    }
    this.manager.create(this.workspace.type);
  }

  deleteWorkspace(): void {
    if (!this.workspace) return;
    this.manager.delete(this.workspace.id);
  }

  reanalyze(): void {
    if (!this.workspace) return;
    const obs = this.knowledge.reanalyze(this.workspace.id);
    if (obs) obs.subscribe({ error: () => {} });
  }

  cancelAnalysis(): void {
    if (!this.workspace) return;
    this.knowledge.cancelAnalysis(this.workspace.id);
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  startRename(): void {
    if (!this.workspace) return;
    this.renameValue = this.workspace.name;
    this.renaming = true;
    setTimeout(() => {
      (document.querySelector('.ws-panel-name-input') as HTMLInputElement | null)?.focus();
    });
  }

  commitRename(): void {
    if (!this.workspace) { this.renaming = false; return; }
    const trimmed = this.renameValue.trim();
    if (trimmed && trimmed !== this.workspace.name) {
      this.manager.rename(this.workspace.id, trimmed);
    }
    this.renaming = false;
  }

  cancelRename(): void {
    this.renaming = false;
  }

  onRenameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.commitRename();
    if (event.key === 'Escape') this.cancelRename();
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async exportJson(): Promise<void> {
    const model = this.workspace?.knowledgeModel;
    if (!model || this.isExporting) return;
    this.isExporting = true;
    try {
      await this.exportSvc.export('json', model);
    } finally {
      this.isExporting = false;
    }
  }

  async exportPdf(): Promise<void> {
    const model = this.workspace?.knowledgeModel;
    if (!model || this.isExporting) return;
    this.isExporting = true;
    try {
      await this.exportSvc.export('pdf', model);
    } finally {
      this.isExporting = false;
    }
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  get typeLabel(): string {
    if (!this.workspace) return '';
    const map: Record<WorkspaceType, string> = {
      file:       'File Analysis',
      folder:     'Folder Analysis',
      repository: 'Repository Analysis',
    };
    return map[this.workspace.type];
  }

  get statusLabel(): string {
    if (!this.workspace) return '';
    const map: Record<WorkspaceStatus, string> = {
      'empty':      'Empty',
      'processing': 'Loading',
      'ready':      'Ready',
      'failed':     'Incomplete',
      'error':      'Error',
    };
    return map[this.workspace.status];
  }

  get statusClass(): string {
    if (!this.workspace) return '';
    const map: Record<WorkspaceStatus, string> = {
      'empty':      'status-empty',
      'processing': 'status-analyzing',
      'ready':      'status-loaded',
      'failed':     'status-failed',
      'error':      'status-error',
    };
    return map[this.workspace.status];
  }

  get failedStageLabels(): string[] {
    const stages = this.workspace?.knowledgeModel?.ai?.failedStages ?? [];
    return stages.map(s => STAGE_LABELS[s] ?? s);
  }

  get hasPartialFailure(): boolean {
    return (this.workspace?.knowledgeModel?.ai?.failedStages?.length ?? 0) > 0;
  }

  get recoveryMessage(): string | null {
    if (this.workspace?.status === 'failed') {
      return 'Previous analysis did not complete.';
    }
    return null;
  }

  get workspaceCount(): number {
    return this.manager.workspaces.length;
  }

  get canCreateNew(): boolean {
    return this.manager.canCreate();
  }

  get canReanalyze(): boolean {
    if (!this.workspace) return false;
    return this.knowledge.canReanalyze(this.workspace.id)
      && this.workspace.status !== 'processing';
  }

  get isAnalyzing(): boolean {
    return this.workspace?.status === 'processing' || this.activeStageLabels.length > 0;
  }

  get canExport(): boolean {
    return this.workspace?.status === 'ready' && this.workspace.knowledgeModel !== null;
  }

  get profile() {
    return this.workspace?.knowledgeModel ?? null;
  }
}
