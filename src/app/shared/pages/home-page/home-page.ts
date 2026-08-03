import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ElectronService, AiProviderStatus } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { Workspace, WorkspaceType } from '@app/workspace/models/workspace-entity.model';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink, WorkspaceSwitcherModal],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  host: { 'data-theme': 'dark' },
})
export class HomePage implements OnInit, OnDestroy {
  aiStatus: 'checking' | 'configured' | 'not-configured' = 'checking';
  aiProvider: AiProviderStatus | null = null;
  aiModel = '';
  appVersion = '';

  recentAnalyses: Workspace[] = [];
  activeWorkspace: Workspace | null = null;
  showLimitModal = false;
  limitModalPendingType: WorkspaceType | null = null;
  private subs: Subscription[] = [];

  constructor(
    readonly electronService: ElectronService,
    private readonly cdr: ChangeDetectorRef,
    private readonly manager: WorkspaceManagerService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAiStatus();
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

  startNewAnalysis(type: WorkspaceType): void {
    if (!this.manager.canCreate()) {
      this.limitModalPendingType = type;
      this.showLimitModal = true;
      this.cdr.detectChanges();
      return;
    }
    this.manager.create(type);
    const routes: Record<WorkspaceType, string> = {
      file: '/file-analysis',
      folder: '/folder-analysis',
      repository: '/repository-analysis',
    };
    this.router.navigate([routes[type]]);
  }

  closeLimitModal(): void {
    this.showLimitModal = false;
    this.limitModalPendingType = null;
  }

  private async loadAiStatus(): Promise<void> {
    try {
      const [providers, settings] = await Promise.all([
        this.electronService.aiGetProviders(),
        this.electronService.getAllSettings(),
      ]);
      const active = providers.find(p => p.active && p.configured) ?? null;
      this.aiProvider = active;
      this.aiStatus = active ? 'configured' : 'not-configured';
      this.aiModel = (settings['aiModel'] as string) ?? '';
    } catch {
      this.aiStatus = 'not-configured';
    }
    this.cdr.detectChanges();
  }
}
