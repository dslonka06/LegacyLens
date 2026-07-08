import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '@app/core/services/theme.service';
import { ElectronService } from '@app/core/services/electron.service';
import { RepositoryLibraryService } from '@app/core/services/repository-library.service';
import { PendingRepositoryService } from '@app/core/services/pending-repository.service';
import type { ElectronRepository } from '../../../../electron';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage implements OnInit {

  aiProviderStatus: 'checking' | 'configured' | 'not-configured' = 'checking';
  aiProviderLabel = 'Claude Sonnet';

  repositories: ElectronRepository[] = [];
  isLoadingRepo: string | null = null; // id of repo currently being opened

  constructor(
    readonly theme: ThemeService,
    readonly electronService: ElectronService,
    private readonly repoLibrary: RepositoryLibraryService,
    private readonly pendingRepo: PendingRepositoryService,
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.checkAiProvider();
    if (this.electronService.isElectron) {
      this.loadRepositories();
    }
  }

  private async loadRepositories(): Promise<void> {
    this.repositories = await this.repoLibrary.getAll();
    this.cdr.detectChanges();
  }

  async addRepository(): Promise<void> {
    const folderPath = await this.electronService.pickFolder('Select Repository Folder');
    if (!folderPath) return;

    const folderName = folderPath.split(/[\\/]/).pop() ?? 'Repository';
    const repo = await this.repoLibrary.add({ name: folderName, path: folderPath });

    this.repositories = await this.repoLibrary.getAll();
    this.cdr.detectChanges();

    this.openRepositoryByPath(repo.id, folderPath);
  }

  async openRepository(repo: ElectronRepository): Promise<void> {
    if (this.isLoadingRepo) return;
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
    this.repositories = this.repositories.filter(r => r.id !== id);
    this.cdr.detectChanges();
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
    this.http.get<{ available: boolean; model?: string }>('http://localhost:5000/api/ai/status', {})
      .subscribe({
        next: res => {
          this.aiProviderStatus = res.available ? 'configured' : 'not-configured';
          if (res.model) this.aiProviderLabel = res.model;
        },
        error: () => {
          this.aiProviderStatus = 'not-configured';
        }
      });
  }
}
