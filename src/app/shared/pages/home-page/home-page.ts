import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ThemeService } from '@app/core/services/theme.service';
import { ElectronService } from '@app/core/services/electron.service';
import { RepositoryLibraryService } from '@app/core/services/repository-library.service';
import { PendingRepositoryService } from '@app/core/services/pending-repository.service';
import {
  TargetValidationService,
  ValidationResult,
  AnalysisTarget,
} from '@app/core/services/target-validation.service';
import { ValidationDialog } from '@app/shared/components/validation-dialog/validation-dialog';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { Workspace } from '@app/workspace/models/workspace-entity.model';
import type { ElectronRepository } from '../../../../electron';

const ANALYSIS_ROUTES: Record<AnalysisTarget, string> = {
  file: '/file-analysis',
  folder: '/folder-analysis',
  repository: '/repository-analysis',
};

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ValidationDialog, ThemeToggle],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit, OnDestroy {
  aiProviderStatus: 'checking' | 'configured' | 'not-configured' = 'checking';
  aiProviderLabel = 'Claude Sonnet';

  recentAnalyses: Workspace[] = [];
  private subs: Subscription[] = [];

  repositories: ElectronRepository[] = [];
  isLoadingRepo: string | null = null;

  // 'checking' shown only during initial load, avoids flash of missing state
  repoPathStatus = new Map<string, 'ok' | 'missing' | 'checking'>();

  editingRepoId: string | null = null;
  editingName = '';

  refreshingRepoId: string | null = null;

  validationResult: ValidationResult | null = null;
  private pendingAddPath: string | null = null;
  private pendingAddRepoId: string | null = null;

  constructor(
    readonly theme: ThemeService,
    readonly electronService: ElectronService,
    private readonly repoLibrary: RepositoryLibraryService,
    private readonly pendingRepo: PendingRepositoryService,
    private readonly targetValidation: TargetValidationService,
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly http: HttpClient,
    private readonly manager: WorkspaceManagerService,
  ) {}

  ngOnInit(): void {
    this.checkAiProvider();
    if (this.electronService.isElectron) {
      this.loadRepositories();
    }
    this.subs.push(
      this.manager.workspaces$.subscribe((ws) => {
        this.recentAnalyses = ws
          .filter((w) => w.status !== 'empty')
          .sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))
          .slice(0, 3);
        this.cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  recentTypeLabel(type: string): string {
    if (type === 'file') return 'File';
    if (type === 'folder') return 'Folder';
    return 'Repository';
  }

  openRecentAnalysis(ws: Workspace): void {
    this.manager.activate(ws.id);
  }

  private async loadRepositories(): Promise<void> {
    this.repositories = await this.repoLibrary.getAll();
    this.cdr.detectChanges();
    this.checkRepoPaths();
    this.maybeAutoRestore();
  }

  private async checkRepoPaths(): Promise<void> {
    for (const repo of this.repositories) {
      this.repoPathStatus.set(repo.id, 'checking');
    }
    this.cdr.detectChanges();

    await Promise.all(
      this.repositories.map(async (repo) => {
        try {
          const result = await this.electronService.detectTarget(repo.path);
          this.repoPathStatus.set(repo.id, result.detected === 'invalid' ? 'missing' : 'ok');
        } catch {
          this.repoPathStatus.set(repo.id, 'missing');
        }
      }),
    );
    this.cdr.detectChanges();
  }

  private maybeAutoRestore(): void {
    const last = this.repositories[0];
    if (!last?.lastOpened) return;
    const diffMs = Date.now() - new Date(last.lastOpened).getTime();
    if (diffMs < 86400000) {
      this.openRepository(last);
    }
  }

  async addRepository(): Promise<void> {
    const folderPath = await this.electronService.pickFolder('Select Repository Folder');
    if (!folderPath) return;

    const validation = await this.targetValidation.validate(folderPath, 'repository');

    if (!validation.valid && validation.mismatch) {
      const folderName = folderPath.split(/[\\/]/).pop() ?? 'Repository';
      const repo = await this.repoLibrary.add({ name: folderName, path: folderPath });
      this.repositories = await this.repoLibrary.getAll();
      this.cdr.detectChanges();

      this.pendingAddPath = folderPath;
      this.pendingAddRepoId = repo.id;
      this.validationResult = validation;
      this.cdr.detectChanges();
      return;
    }

    if (!validation.valid) {
      return;
    }

    this.completeAddRepository(folderPath);
  }

  private async completeAddRepository(folderPath: string): Promise<void> {
    const folderName = folderPath.split(/[\\/]/).pop() ?? 'Repository';
    const repo = await this.repoLibrary.add({ name: folderName, path: folderPath });
    this.repositories = await this.repoLibrary.getAll();
    this.cdr.detectChanges();
    this.checkRepoPaths();
    this.openRepositoryByPath(repo.id, folderPath);
  }

  onValidationProceed(target: AnalysisTarget): void {
    const path = this.pendingAddPath;
    const repoId = this.pendingAddRepoId;
    this.validationResult = null;
    this.pendingAddPath = null;
    this.pendingAddRepoId = null;

    if (!path || !repoId) return;

    if (target === 'repository') {
      this.openRepositoryByPath(repoId, path);
    } else {
      this.zone.run(() => this.router.navigate([ANALYSIS_ROUTES[target]]));
    }
  }

  onValidationCancel(): void {
    this.validationResult = null;
    this.pendingAddPath = null;
    this.pendingAddRepoId = null;
  }

  async openRepository(repo: ElectronRepository): Promise<void> {
    if (this.isLoadingRepo) return;
    if (this.repoPathStatus.get(repo.id) === 'missing') return;
    await this.repoLibrary.touch(repo.id);
    this.openRepositoryByPath(repo.id, repo.path);
  }

  private openRepositoryByPath(repositoryId: string, path: string): void {
    this.isLoadingRepo = repositoryId;
    this.cdr.detectChanges();
    this.pendingRepo.set(path, repositoryId);
    this.zone.run(() => this.router.navigate(['/repository-analysis']));
  }

  async removeRepository(event: Event, id: string): Promise<void> {
    event.stopPropagation();
    await this.repoLibrary.remove(id);
    this.repoPathStatus.delete(id);
    this.repositories = this.repositories.filter((r) => r.id !== id);
    this.cdr.detectChanges();
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  startRename(event: Event, repo: ElectronRepository): void {
    event.stopPropagation();
    this.editingRepoId = repo.id;
    this.editingName = repo.name;
    this.cdr.detectChanges();
  }

  async commitRename(repo: ElectronRepository): Promise<void> {
    const trimmed = this.editingName.trim();
    this.editingRepoId = null;
    if (!trimmed || trimmed === repo.name) return;
    await this.repoLibrary.update(repo.id, { name: trimmed });
    this.repositories = await this.repoLibrary.getAll();
    this.cdr.detectChanges();
  }

  cancelRename(): void {
    this.editingRepoId = null;
    this.editingName = '';
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refreshRepo(event: Event, repo: ElectronRepository): Promise<void> {
    event.stopPropagation();
    if (this.refreshingRepoId === repo.id) return;
    this.refreshingRepoId = repo.id;
    this.cdr.detectChanges();
    try {
      // touch re-reads git metadata on the main process side
      await this.repoLibrary.touch(repo.id);
      this.repositories = await this.repoLibrary.getAll();
      // re-validate path after refresh
      const result = await this.electronService.detectTarget(repo.path);
      this.repoPathStatus.set(repo.id, result.detected === 'invalid' ? 'missing' : 'ok');
    } finally {
      this.refreshingRepoId = null;
      this.cdr.detectChanges();
    }
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  isPathMissing(id: string): boolean {
    return this.repoPathStatus.get(id) === 'missing';
  }

  formatLastOpened(iso: string | null): string {
    if (!iso) return 'Never opened';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  }

  private checkAiProvider(): void {
    this.http
      .get<{ available: boolean; model?: string }>('http://localhost:5000/api/ai/status', {})
      .subscribe({
        next: (res) => {
          this.aiProviderStatus = res.available ? 'configured' : 'not-configured';
          if (res.model) this.aiProviderLabel = res.model;
        },
        error: () => {
          this.aiProviderStatus = 'not-configured';
        },
      });
  }
}
