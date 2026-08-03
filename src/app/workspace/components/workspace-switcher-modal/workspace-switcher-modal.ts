import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  Workspace,
  WorkspaceStatus,
  WorkspaceType,
} from '@app/workspace/models/workspace-entity.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { ElectronService } from '@app/core/services/electron.service';

@Component({
  selector: 'app-workspace-switcher-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace-switcher-modal.html',
  styleUrl: './workspace-switcher-modal.scss',
})
export class WorkspaceSwitcherModal implements OnInit, OnDestroy {
  @Input() limitReached = false;
  @Input() pendingType: WorkspaceType | null = null;
  @Output() close = new EventEmitter<void>();

  workspaces: Workspace[] = [];
  activeId: string | null = null;

  renamingId: string | null = null;
  renameValue = '';

  aiModel = '';

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly electron: ElectronService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.manager.workspaces$.subscribe((ws) => {
      this.workspaces = ws;
    });
    this.activeId = this.manager.activeId;
    this.electron.getSetting('aiModel').then((v) => {
      this.aiModel = (v as string) ?? '';
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get canCreate(): boolean {
    return this.manager.canCreate();
  }

  open(ws: Workspace): void {
    if (this.renamingId === ws.id) return;
    this.manager.activate(ws.id);
    this.close.emit();
  }

  newWorkspace(): void {
    if (!this.manager.canCreate()) return;
    const activeType = this.workspaces.find((w) => w.id === this.activeId)?.type ?? 'file';
    this.manager.create(activeType);
    this.close.emit();
  }

  startRename(ws: Workspace, event: MouseEvent): void {
    event.stopPropagation();
    this.renamingId = ws.id;
    this.renameValue = ws.name;
  }

  commitRename(ws: Workspace): void {
    const name = this.renameValue.trim();
    if (name && name !== ws.name) {
      this.manager.rename(ws.id, name);
    }
    this.renamingId = null;
  }

  cancelRename(): void {
    this.renamingId = null;
  }

  delete(ws: Workspace, event: MouseEvent): void {
    event.stopPropagation();
    this.manager.delete(ws.id);
    if (this.pendingType && this.manager.canCreate()) {
      this.manager.create(this.pendingType);
      this.close.emit();
      this.router.navigate([this.routeForType(this.pendingType)]);
      return;
    }
    if (this.workspaces.length === 0) this.close.emit();
  }

  continueToExisting(): void {
    if (!this.pendingType) { this.close.emit(); return; }
    const existing = this.manager.workspaces
      .filter((w) => w.type === this.pendingType)
      .sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))[0] ?? null;
    if (existing) {
      this.manager.activate(existing.id);
      this.close.emit();
      this.router.navigate([this.routeForType(this.pendingType!)]);
    } else {
      this.close.emit();
    }
  }

  saveAiModel(): void {
    this.electron.setSetting('aiModel', this.aiModel.trim() || null);
  }

  dismiss(): void {
    this.close.emit();
  }

  private routeForType(type: WorkspaceType): string {
    if (type === 'file') return '/file-analysis';
    if (type === 'folder') return '/folder-analysis';
    return '/repository-analysis';
  }

  typeLabel(type: WorkspaceType): string {
    const map: Record<WorkspaceType, string> = {
      file: 'File',
      folder: 'Folder',
      repository: 'Repository',
    };
    return map[type];
  }

  statusLabel(status: WorkspaceStatus): string {
    const map: Record<WorkspaceStatus, string> = {
      empty: 'Empty',
      processing: 'Analyzing',
      ready: 'Ready',
      failed: 'Incomplete',
      error: 'Error',
    };
    return map[status];
  }

  statusClass(status: WorkspaceStatus): string {
    const map: Record<WorkspaceStatus, string> = {
      empty: 'status-empty',
      processing: 'status-analyzing',
      ready: 'status-loaded',
      failed: 'status-failed',
      error: 'status-error',
    };
    return map[status];
  }
}
