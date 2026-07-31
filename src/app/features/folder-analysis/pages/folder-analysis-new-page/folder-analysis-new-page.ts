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
  selector: 'app-folder-analysis-new-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ThemeToggle],
  templateUrl: './folder-analysis-new-page.html',
  styleUrl: './folder-analysis-new-page.scss',
})
export class FolderAnalysisNewPage implements OnInit, OnDestroy {
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
    const ws = this.manager.createNew('folder');
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
    if (this.workspaceId) {
      const ws = this.manager.getById(this.workspaceId);
      if (ws?.status === 'empty') {
        this.manager.delete(this.workspaceId);
      }
    }
  }

  browseFolder(): void {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
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

    if (files.length === 1 && !files[0].type && files[0].size === 0) {
      this.uploadError = 'Could not read that folder. Try using the Browse button.';
      return;
    }

    const id = this.workspaceId;
    if (!id) return;

    this.workspaceId = null;

    const folderName =
      (files[0] as any).webkitRelativePath?.split('/')[0] ??
      files[0].name.replace(/\.[^.]+$/, '') ??
      'folder';

    this.manager.rename(id, folderName);

    this.filesToEntries(files).then((entries) => {
      this.knowledge
        .process('folder', entries, {
          workspaceId: id,
          workspaceName: folderName,
          persist: false,
        })
        .subscribe({ error: () => {} });
      this.zone.run(() => this.router.navigate(['/folder-analysis']));
    });
  }

  private filesToEntries(files: File[]): Promise<ElectronDirectoryEntry[]> {
    return Promise.all(
      files.map(
        (f) =>
          new Promise<ElectronDirectoryEntry>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                relativePath: (f as any).webkitRelativePath || f.name,
                content: reader.result as string,
                size: f.size,
                modifiedAt: new Date(f.lastModified).toISOString(),
              });
            reader.onerror = () =>
              resolve({
                name: f.name,
                relativePath: (f as any).webkitRelativePath || f.name,
                content: null,
                size: f.size,
                modifiedAt: new Date(f.lastModified).toISOString(),
              });
            reader.readAsText(f);
          }),
      ),
    );
  }
}
