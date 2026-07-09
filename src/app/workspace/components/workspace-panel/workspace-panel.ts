import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Workspace, WorkspaceStatus, WorkspaceType } from '@app/workspace/models/workspace-entity.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

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

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.workspace = ws;
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
      'error':      'status-error',
    };
    return map[this.workspace.status];
  }

  get workspaceCount(): number {
    return this.manager.workspaces.length;
  }

  get canCreateNew(): boolean {
    return this.manager.canCreate();
  }

  get profile() {
    return this.workspace?.knowledgeModel ?? null;
  }
}
