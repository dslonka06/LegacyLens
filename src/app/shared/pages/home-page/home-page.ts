import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '@app/core/services/theme.service';

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

  constructor(
    readonly theme: ThemeService,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.checkAiProvider();
  }

  private checkAiProvider(): void {
    this.http.get<{ available: boolean; model?: string }>('http://localhost:5000/api/ai/status', {})
      .subscribe({
        next: res => {
          this.aiProviderStatus = res.available ? 'configured' : 'not-configured';
          if (res.model) this.aiProviderLabel = res.model;
        },
        error: () => {
          // Backend unreachable — treat as not configured rather than crashing
          this.aiProviderStatus = 'not-configured';
        }
      });
  }
}
