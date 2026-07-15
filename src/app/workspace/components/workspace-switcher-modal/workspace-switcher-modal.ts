import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    if (this.workspaces.length === 0) this.close.emit();
  }

  saveAiModel(): void {
    this.electron.setSetting('aiModel', this.aiModel.trim() || null);
  }

  dismiss(): void {
    this.close.emit();
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
