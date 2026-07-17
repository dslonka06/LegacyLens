import { Component, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ActiveWorkspaceService,
  ActiveWorkspace,
} from '@app/core/services/active-workspace.service';
import { SidebarService } from '@app/core/services/sidebar.service';
import { ChatService } from '@app/core/services/chat.service';

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
  chatOpen = false;

  @HostBinding('class.sidebar--collapsed') get collapsedClass() { return this.collapsed; }
  private subs: Subscription[] = [];

  constructor(
    private readonly activeWorkspaceService: ActiveWorkspaceService,
    private readonly sidebarService: SidebarService,
    private readonly chatService: ChatService,
  ) {}

  ngOnInit(): void {
    this.activeWorkspace = this.activeWorkspaceService.workspace;
    this.collapsed = this.sidebarService.collapsed;
    this.chatOpen = this.chatService.open;

    this.subs.push(
      this.activeWorkspaceService.workspace$.subscribe((w) => {
        this.activeWorkspace = w;
      }),
      this.sidebarService.collapsed$.subscribe((c) => {
        this.collapsed = c;
      }),
      this.chatService.open$.subscribe((o) => {
        this.chatOpen = o;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  toggleCollapse(): void {
    this.sidebarService.toggle();
  }

  toggleChat(): void {
    this.chatService.toggle();
  }
}
