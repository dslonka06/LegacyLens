import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import type { ElectronDirectoryEntry } from '../../../../../electron';

@Component({
  selector: 'app-file-analysis-new-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ThemeToggle],
  templateUrl: './file-analysis-new-page.html',
  styleUrl: './file-analysis-new-page.scss',
})
export class FileAnalysisNewPage implements OnInit, OnDestroy {
  uploadError: string | null = null;
  isDragging = false;
  showSwitcher = false;
  switcherLimitReached = false;

  private workspaceId: string | null = null;
  private limitSub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    const ws = this.manager.createNew('file');
    if (!ws) {
      this.switcherLimitReached = true;
      this.showSwitcher = true;
    } else {
      this.workspaceId = ws.id;
    }
    this.limitSub = this.manager.limitReached$.subscribe(() => {
      this.switcherLimitReached = true;
      this.showSwitcher = true;
    });
  }

  ngOnDestroy(): void {
    this.limitSub?.unsubscribe();
    // If user leaves without starting an analysis, clean up the empty workspace
    if (this.workspaceId) {
      const ws = this.manager.getById(this.workspaceId);
      if (ws?.status === 'empty') {
        this.manager.delete(this.workspaceId);
      }
    }
  }

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

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }

  private processFiles(files: File[]): void {
    this.uploadError = null;

    if (files.length > 1) {
      this.uploadError =
        'File analysis supports one file at a time. For multiple files, try Folder Analysis.';
      return;
    }

    const file = files[0];
    if (file.size === 0 && !file.type) {
      this.uploadError =
        'That looks like a folder. Use Folder Analysis to analyze a whole directory.';
      return;
    }

    const id = this.workspaceId;
    if (!id) return;

    // Prevent ngOnDestroy cleanup from deleting this workspace now that analysis is starting
    const wsId = this.workspaceId;
    this.workspaceId = null;

    this.manager.rename(id, file.name);
    this.fileToEntry(file).then((entry) => {
      this.knowledge
        .process('file', [entry], {
          workspaceId: id,
          workspaceName: file.name,
          persist: false,
        })
        .subscribe({ error: () => {} });
      this.zone.run(() => this.router.navigate(['/file-analysis']));
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
}
