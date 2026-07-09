import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Workspace, WorkspaceStatus, WorkspaceType } from '@app/workspace/models/workspace-entity.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

@Component({
  selector: 'app-workspace-switcher-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workspace-switcher-modal.html',
  styleUrl: './workspace-switcher-modal.scss',
})
export class WorkspaceSwitcherModal implements OnInit, OnDestroy {

  // When true the modal was opened because the workspace limit was reached
  @Input() limitReached = false;
  @Output() close = new EventEmitter<void>();

  workspaces: Workspace[] = [];
  activeId: string | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.workspaces$.subscribe(ws => {
      this.workspaces = ws;
    });
    this.activeId = this.manager.activeId;
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  open(ws: Workspace): void {
    this.manager.activate(ws.id);
    this.close.emit();
  }

  delete(ws: Workspace, event: MouseEvent): void {
    event.stopPropagation();
    this.manager.delete(ws.id);
    if (this.workspaces.length === 0) this.close.emit();
  }

  dismiss(): void {
    this.close.emit();
  }

  typeLabel(type: WorkspaceType): string {
    const map: Record<WorkspaceType, string> = {
      file:       'File Analysis',
      folder:     'Folder Analysis',
      repository: 'Repository Analysis',
    };
    return map[type];
  }

  statusLabel(status: WorkspaceStatus): string {
    const map: Record<WorkspaceStatus, string> = {
      'empty':      'Empty',
      'processing': 'Analyzing',
      'ready':      'Ready',
      'error':      'Error',
    };
    return map[status];
  }

  statusClass(status: WorkspaceStatus): string {
    const map: Record<WorkspaceStatus, string> = {
      'empty':      'status-empty',
      'processing': 'status-analyzing',
      'ready':      'status-loaded',
      'error':      'status-error',
    };
    return map[status];
  }
}
