import { Component, HostBinding, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActiveWorkspaceService, ActiveWorkspace } from '@app/core/services/active-workspace.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit, OnDestroy {
  @HostBinding('class.collapsed') collapsed = false;

  activeWorkspace: ActiveWorkspace = null;
  private sub: Subscription | null = null;

  constructor(private readonly activeWorkspaceService: ActiveWorkspaceService) {}

  ngOnInit(): void {
    this.activeWorkspace = this.activeWorkspaceService.workspace;
    this.sub = this.activeWorkspaceService.workspace$.subscribe(w => {
      this.activeWorkspace = w;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }
}
