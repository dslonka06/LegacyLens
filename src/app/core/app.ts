import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { Sidebar } from '@app/shell/sidebar/sidebar';
import { AiChatPanel } from '@app/shell/ai-chat-panel/ai-chat-panel';
import { UpdatePrompt } from '@app/shell/update-prompt/update-prompt';
import { SidebarService } from '@app/core/services/sidebar.service';

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
export class App implements OnInit {
  isHome = false;
  chatOpen = false;

  constructor(
    private readonly router: Router,
    private readonly sidebarService: SidebarService,
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects;
        this.isHome = url === '/';

        // Expand sidebar and close chat when landing on a hub page
        const isHub = HUB_ROUTES.some((r) => url === r);
        if (isHub) {
          this.sidebarService.expand();
          this.chatOpen = false;
        }
      });

    this.isHome = this.router.url === '/';
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
  }

  closeChat(): void {
    this.chatOpen = false;
  }
}
