import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { Sidebar } from '@app/shell/sidebar/sidebar';
import { AiChatPanel } from '@app/shell/ai-chat-panel/ai-chat-panel';
import { UpdatePrompt } from '@app/shell/update-prompt/update-prompt';
import { SidebarService } from '@app/core/services/sidebar.service';
import { ChatService } from '@app/core/services/chat.service';
const HUB_ROUTES = [
  '/file-analysis',
  '/folder-analysis',
  '/repository-analysis',
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, AiChatPanel, UpdatePrompt, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  isHome = false;
  chatOpen = false;

  private subs: Subscription[] = [];

  constructor(
    private readonly router: Router,
    private readonly sidebarService: SidebarService,
    private readonly chatService: ChatService,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.chatService.open$.subscribe((open) => {
        this.chatOpen = open;
      }),
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          const url = e.urlAfterRedirects;
          this.isHome = url === '/';

          const isHub = HUB_ROUTES.some((r) => url === r);
          if (isHub) {
            this.sidebarService.expand();
            this.chatService.close();
          }
        }),
    );

    this.isHome = this.router.url === '/';
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  toggleChat(): void {
    this.chatService.toggle();
  }

  closeChat(): void {
    this.chatService.close();
  }
}
