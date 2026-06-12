import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription, switchMap, of } from 'rxjs';
import { ModifiedFile, ModifiedFileStatus, RecommendationSource } from '../../models/modified-file.model';
import { WorkspaceChangesService, DiffLine } from '../../services/workspace-changes.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { ExportService } from '../../services/export.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../resize-divider/resize-divider.component';

type Scope = 'file' | 'folder' | 'repository';
type FilterTab = 'all' | ModifiedFileStatus;

@Component({
  selector: 'app-changes-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ResizeDividerComponent],
  templateUrl: './changes-page.html',
  styleUrl: './changes-page.scss',
})
export class ChangesPageComponent implements OnInit, OnDestroy {

  scope: Scope = 'file';

  allChanges: ModifiedFile[] = [];
  changes: ModifiedFile[] = [];
  selected: ModifiedFile | null = null;
  diff: DiffLine[] = [];
  panelWidths = [280];

  activeFilter: FilterTab = 'all';

  private sub: Subscription | null = null;

  constructor(
    private readonly changesService: WorkspaceChangesService,
    private readonly manager: WorkspaceManagerService,
    private readonly exportService: ExportService,
    private readonly layoutService: PanelLayoutService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.scope = this.route.snapshot.data['scope'] as Scope ?? 'file';
    this.panelWidths = this.layoutService.load(`${this.scope}-changes`) ?? [280];

    this.sub = this.manager.activeId$.pipe(
      switchMap(id => id ? this.changesService.changes$(id) : of([])),
    ).subscribe(c => {
      this.allChanges = c;
      this.applyFilter();
      if (this.selected) {
        const refreshed = c.find(f => f.id === this.selected!.id) ?? null;
        this.selectFile(refreshed);
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save(`${this.scope}-changes`, this.panelWidths);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  setFilter(tab: FilterTab): void {
    this.activeFilter = tab;
    this.applyFilter();
    this.cdr.detectChanges();
  }

  private applyFilter(): void {
    this.changes = this.activeFilter === 'all'
      ? this.allChanges
      : this.allChanges.filter(f => f.status === this.activeFilter);
  }

  filterCount(tab: FilterTab): number {
    return tab === 'all'
      ? this.allChanges.length
      : this.allChanges.filter(f => f.status === tab).length;
  }

  // ── File selection ─────────────────────────────────────────────────────────

  selectFile(file: ModifiedFile | null): void {
    this.selected = file;
    this.diff = file ? this.changesService.computeDiff(file.originalContent, file.modifiedContent) : [];
  }

  // ── Status actions ─────────────────────────────────────────────────────────

  approve(file: ModifiedFile): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setStatus(id, file.id, 'approved');
  }

  reject(file: ModifiedFile): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setStatus(id, file.id, 'rejected');
  }

  restore(file: ModifiedFile): void {
    const id = this.manager.activeId;
    if (id) this.changesService.restore(id, file.id);
    if (this.selected?.id === file.id) this.selectFile(null);
  }

  approveAll(): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setAllStatus(id, 'approved');
  }

  rejectAll(): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setAllStatus(id, 'rejected');
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  exportChanges(): void {
    const approved = this.allChanges.filter(f => f.status === 'approved');
    if (!approved.length) return;
    if (this.scope === 'file') {
      this.exportService.exportSingleFile(approved[0]);
    } else {
      const name = this.scope === 'folder' ? 'ModifiedFolder.zip' : 'ModifiedRepository.zip';
      this.exportService.exportAsZip(approved, name);
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  get addCount():      number { return this.diff.filter(l => l.type === 'added').length; }
  get removeCount():   number { return this.diff.filter(l => l.type === 'removed').length; }
  get pendingCount():  number { return this.allChanges.filter(f => f.status === 'pending').length; }
  get approvedCount(): number { return this.allChanges.filter(f => f.status === 'approved').length; }
  get rejectedCount(): number { return this.allChanges.filter(f => f.status === 'rejected').length; }
  get exportedCount(): number { return this.allChanges.filter(f => f.status === 'exported').length; }

  totalAdds(f: ModifiedFile): number {
    return this.changesService.computeDiff(f.originalContent, f.modifiedContent)
      .filter(l => l.type === 'added').length;
  }
  totalRemoves(f: ModifiedFile): number {
    return this.changesService.computeDiff(f.originalContent, f.modifiedContent)
      .filter(l => l.type === 'removed').length;
  }

  // ── Route helpers ──────────────────────────────────────────────────────────

  get recommendationsRoute(): string {
    return `/${this.scope}-analysis/code-recommendations`;
  }

  get showGitHub(): boolean { return this.scope === 'repository'; }

  // ── Display helpers ────────────────────────────────────────────────────────

  statusClass(f: ModifiedFile): string {
    return {
      pending:  'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      exported: 'status-exported',
    }[f.status] ?? 'status-pending';
  }

  statusLabel(f: ModifiedFile): string {
    return {
      pending:  'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      exported: 'Exported',
    }[f.status] ?? 'Pending';
  }

  severityClass(s?: string): string {
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low' } as any)[s ?? ''] ?? 'sev-low';
  }

  recommendationSeverityClass(r: RecommendationSource): string {
    return this.severityClass(r.severity);
  }
}
