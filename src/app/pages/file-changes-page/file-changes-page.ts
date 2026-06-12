import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, switchMap, of } from 'rxjs';
import { ModifiedFile } from '../../models/modified-file.model';
import { WorkspaceChangesService, DiffLine } from '../../services/workspace-changes.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { ExportService } from '../../services/export.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';

@Component({
  selector: 'app-file-changes-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ResizeDividerComponent],
  templateUrl: './file-changes-page.html',
  styleUrl: './file-changes-page.scss',
})
export class FileChangesPage implements OnInit, OnDestroy {

  changes: ModifiedFile[] = [];
  selected: ModifiedFile | null = null;
  diff: DiffLine[] = [];
  panelWidths = [280];

  private sub: Subscription | null = null;

  constructor(
    private readonly changesService: WorkspaceChangesService,
    private readonly manager: WorkspaceManagerService,
    private readonly exportService: ExportService,
    private readonly layoutService: PanelLayoutService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('file-changes') ?? [280];
    this.sub = this.manager.activeId$.pipe(
      switchMap(id => id ? this.changesService.changes$(id) : of([])),
    ).subscribe(c => {
      this.changes = c;
      if (this.selected) {
        const refreshed = c.find(f => f.id === this.selected!.id) ?? null;
        this.select(refreshed);
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('file-changes', this.panelWidths);
  }

  select(file: ModifiedFile | null): void {
    this.selected = file;
    this.diff = file ? this.changesService.computeDiff(file.originalContent, file.modifiedContent) : [];
  }

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
    if (this.selected?.id === file.id) this.select(null);
  }

  approveAll(): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setAllStatus(id, 'approved');
  }

  rejectAll(): void {
    const id = this.manager.activeId;
    if (id) this.changesService.setAllStatus(id, 'rejected');
  }

  exportChanges(): void {
    const approved = this.changes.filter(f => f.status === 'approved');
    if (!approved.length) return;
    // File workspace always has one file — export it directly, not as ZIP.
    this.exportService.exportSingleFile(approved[0]);
  }

  get addCount():     number { return this.diff.filter(l => l.type === 'added').length; }
  get removeCount():  number { return this.diff.filter(l => l.type === 'removed').length; }
  get pendingCount(): number { return this.changes.filter(f => f.status === 'pending').length; }
  get approvedCount():number { return this.changes.filter(f => f.status === 'approved').length; }

  totalAdds(f: ModifiedFile): number {
    return this.changesService.computeDiff(f.originalContent, f.modifiedContent)
      .filter(l => l.type === 'added').length;
  }
  totalRemoves(f: ModifiedFile): number {
    return this.changesService.computeDiff(f.originalContent, f.modifiedContent)
      .filter(l => l.type === 'removed').length;
  }

  statusClass(f: ModifiedFile): string {
    return ({ pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' })[f.status];
  }
  statusLabel(f: ModifiedFile): string {
    return ({ pending: 'Pending', approved: 'Approved', rejected: 'Rejected' })[f.status];
  }
  severityClass(s?: string): string {
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low' } as any)[s ?? ''] ?? 'sev-low';
  }
}
