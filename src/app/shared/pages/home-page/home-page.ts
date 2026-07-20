import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { Workspace } from '@app/workspace/models/workspace-entity.model';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit, OnDestroy {
  aiProviderStatus: 'checking' | 'configured' | 'not-configured' = 'checking';
  aiProviderLabel = 'Claude Sonnet';
  appVersion = '';

  recentAnalyses: Workspace[] = [];
  activeWorkspace: Workspace | null = null;
  private subs: Subscription[] = [];

  constructor(
    readonly electronService: ElectronService,
    private readonly cdr: ChangeDetectorRef,
    private readonly http: HttpClient,
    private readonly manager: WorkspaceManagerService,
  ) {}

  ngOnInit(): void {
    this.checkAiProvider();
    if (this.electronService.isElectron) {
      this.electronService.getAppVersion().then((v) => {
        this.appVersion = v ? `v${v}` : '';
        this.cdr.detectChanges();
      });
    }
    this.subs.push(
      this.manager.workspaces$.subscribe((ws) => {
        this.recentAnalyses = ws
          .filter((w) => w.status !== 'empty')
          .sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))
          .slice(0, 3);
        this.cdr.detectChanges();
      }),
      this.manager.activeWorkspace$.subscribe((ws) => {
        this.activeWorkspace = ws ?? null;
        this.cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  get heroStatusState(): 'analyzing' | 'recent' | 'idle' {
    if (this.activeWorkspace?.status === 'processing') return 'analyzing';
    if (this.recentAnalyses.length > 0) return 'recent';
    return 'idle';
  }

  get heroStatusName(): string {
    if (this.heroStatusState === 'analyzing') return this.activeWorkspace?.name ?? '';
    if (this.heroStatusState === 'recent') return this.recentAnalyses[0].name;
    return '';
  }

  get heroStatusTime(): string {
    const ws = this.recentAnalyses[0];
    if (!ws?.lastModifiedAt) return '';
    const diffMs = Date.now() - new Date(ws.lastModifiedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  navigateToRecent(): void {
    const ws = this.recentAnalyses[0];
    if (ws) this.manager.activate(ws.id);
  }

  recentTypeLabel(type: string): string {
    if (type === 'file') return 'File';
    if (type === 'folder') return 'Folder';
    return 'Repository';
  }

  openRecentAnalysis(ws: Workspace): void {
    this.manager.activate(ws.id);
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
