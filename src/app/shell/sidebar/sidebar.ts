import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ActiveWorkspaceService,
  ActiveWorkspace,
} from '@app/core/services/active-workspace.service';
import { ThemeService } from '@app/core/services/theme.service';
import { SidebarService } from '@app/core/services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit, OnDestroy {
  activeWorkspace: ActiveWorkspace = null;
  collapsed = false;
  private subs: Subscription[] = [];

  constructor(
    private readonly activeWorkspaceService: ActiveWorkspaceService,
    private readonly themeService: ThemeService,
    private readonly sidebarService: SidebarService,
  ) {}

  ngOnInit(): void {
    this.activeWorkspace = this.activeWorkspaceService.workspace;
    this.collapsed = this.sidebarService.collapsed;

    this.subs.push(
      this.activeWorkspaceService.workspace$.subscribe((w) => {
        this.activeWorkspace = w;
      }),
      this.sidebarService.collapsed$.subscribe((c) => {
        this.collapsed = c;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleCollapse(): void {
    this.sidebarService.toggle();
  }
}
