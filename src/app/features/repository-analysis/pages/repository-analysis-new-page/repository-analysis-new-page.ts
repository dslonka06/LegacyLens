import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { TargetValidationService, ValidationResult, AnalysisTarget } from '@app/core/services/target-validation.service';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { hashContent } from '@app/core/utils/hash';
import type { ElectronDirectoryEntry } from '../../../../../electron';

const EXT_TO_LANGUAGE: Record<string, string> = {
  cs: 'C#', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', sql: 'SQL',
  py: 'Python', json: 'JSON', xml: 'XML', md: 'Markdown', txt: 'Plain Text',
  sh: 'Shell', bash: 'Shell', yml: 'YAML', yaml: 'YAML', rs: 'Rust', go: 'Go',
  java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
  cpp: 'C++', c: 'C', h: 'C/C++ Header', hpp: 'C++ Header',
};

@Component({
  selector: 'app-repository-analysis-new-page',
  standalone: true,
  imports: [CommonModule, WorkspaceSwitcherModal, ValidationDialog, ThemeToggle],
  templateUrl: './repository-analysis-new-page.html',
  styleUrl: './repository-analysis-new-page.scss',
})
export class RepositoryAnalysisNewPage implements OnInit, OnDestroy {
  isScanning = false;
  scanFileCount = 0;
  validationResult: ValidationResult | null = null;
  showSwitcher = false;
  switcherLimitReached = false;

  private workspaceId: string | null = null;
  private pendingValidationPath: string | null = null;
  private scanProgressUnsub: (() => void) | null = null;
  private limitSub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly knowledge: WorkspaceKnowledgeService,
    private readonly electronService: ElectronService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly targetValidation: TargetValidationService,
    private readonly zone: NgZone,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const ws = this.manager.createNew('repository');
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
    this.scanProgressUnsub?.();
    if (this.workspaceId) {
      const ws = this.manager.getById(this.workspaceId);
      if (ws?.status === 'empty') {
        this.manager.delete(this.workspaceId);
      }
    }
  }

  async pickAndLoadFolder(): Promise<void> {
    const folderPath = await this.electronService.pickFolder('Select Repository Folder');
    if (!folderPath) return;
    this.loadFromPath(folderPath);
  }

  onValidationProceed(target: AnalysisTarget): void {
    const path = this.pendingValidationPath;
    this.validationResult = null;
    this.pendingValidationPath = null;
    if (!path) return;

    if (target === 'repository') {
      this.loadFromPath(path);
    } else if (target === 'folder') {
      this.router.navigate(['/folder-analysis/new']);
    } else {
      this.router.navigate(['/file-analysis/new']);
    }
  }

  onValidationCancel(): void {
    this.validationResult = null;
    this.pendingValidationPath = null;
  }

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }

  private async loadFromPath(folderPath: string): Promise<void> {
    const validation = await this.targetValidation.validate(folderPath, 'repository');
    if (!validation.valid && validation.mismatch) {
      this.pendingValidationPath = folderPath;
      this.validationResult = validation;
      return;
    }
    if (!validation.valid) return;

    const activeId = this.workspaceId;
    if (activeId) this.manager.setPath(activeId, folderPath);

    this.isScanning = true;
    this.scanFileCount = 0;
    this.cdr.detectChanges();

    this.scanProgressUnsub = this.electronService.onScanProgress((event) => {
      this.zone.run(() => {
        this.scanFileCount = event.count;
        this.cdr.detectChanges();
      });
    });

    const entries = await this.electronService.readDirectory(folderPath);
    this.scanProgressUnsub?.();
    this.scanProgressUnsub = null;
    this.isScanning = false;

    if (!entries) return;

    const files = entries.map((entry) => {
      const blob = new Blob([entry.content ?? ''], { type: 'text/plain' });
      const file = new File([blob], entry.name, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.relativePath,
        writable: false,
      });
      return file;
    });

    const metadata = this.buildFileMetadata(files);
    const profile = await this.workspaceClassifier.classify(metadata);

    this.zone.run(() => {
      this.currentWorkspace.set(profile, files);
    });

    const id = this.workspaceId;
    const ws = id ? this.manager.getById(id) : null;
    if (ws?.repositoryId) {
      const restored = await this.tryRestoreFromCache(ws.repositoryId, id!, entries);
      if (restored) {
        this.workspaceId = null;
        this.zone.run(() => this.router.navigate(['/repository-analysis']));
        return;
      }
    }

    if (!id) return;

    this.workspaceId = null;

    this.knowledge
      .process('repository', entries, {
        workspaceId: id,
        repositoryId: ws?.repositoryId ?? undefined,
        repositoryPath: folderPath,
        workspaceName: profile.files[0]?.name,
        persist: true,
      })
      .subscribe({ error: () => {} });

    this.zone.run(() => this.router.navigate(['/repository-analysis']));
  }

  private async tryRestoreFromCache(
    repositoryId: string,
    workspaceId: string,
    entries: ElectronDirectoryEntry[],
  ): Promise<boolean> {
    try {
      const saved = await this.electronService.getLatestAnalysis(repositoryId);
      if (!saved?.aiResult) return false;

      const currentHashes = entries
        .filter((e) => e.content !== null)
        .map((e) => ({ relativePath: e.relativePath, hash: hashContent(e.content!) }));

      const changedPaths = await this.electronService.getChangedFiles(repositoryId, currentHashes);
      if (changedPaths.length > 0) return false;

      const restoredModel = await this.knowledge.getLatest(repositoryId);
      if (restoredModel) {
        this.manager.setKnowledgeModel(workspaceId, restoredModel);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private buildFileMetadata(files: File[]): FileMetadata[] {
    return files.map((f) => {
      const name = f.name;
      const path = (f as any).webkitRelativePath || name;
      const parts = name.toLowerCase().split('.');
      const extension = parts.length > 1 ? parts[parts.length - 1] : '';
      return {
        name,
        path,
        extension,
        language: EXT_TO_LANGUAGE[extension] ?? 'Unknown',
        size: f.size,
      };
    });
  }
}
