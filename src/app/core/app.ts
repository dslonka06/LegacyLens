import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { Sidebar } from '@app/shell/sidebar/sidebar';
import { AiChatPanel } from '@app/shell/ai-chat-panel/ai-chat-panel';
import { UpdatePrompt } from '@app/shell/update-prompt/update-prompt';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, AiChatPanel, UpdatePrompt, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isHome  = false;
  chatOpen = false;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.isHome = e.urlAfterRedirects === '/';
      });

    this.isHome = this.router.url === '/';
  }

  toggleChat(): void  { this.chatOpen = !this.chatOpen; }
  closeChat(): void   { this.chatOpen = false; }
}
