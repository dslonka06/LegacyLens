import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Sidebar } from './components/sidebar/sidebar';
import { FeedbackModal } from './components/feedback-modal/feedback-modal';
import { LegacyLensGuide } from './components/legacylens-guide/legacylens-guide';
import { ThemeService } from './services/theme.service';
import { GuideStateService } from './services/guide-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, FeedbackModal, LegacyLensGuide, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  feedbackOpen = false;

  constructor(
    readonly theme: ThemeService,
    readonly guide: GuideStateService,
  ) {}

  ngOnInit(): void {
    this.guide.checkFirstLaunch();
  }

  openFeedback(): void { this.feedbackOpen = true; }
  closeFeedback(): void { this.feedbackOpen = false; }
  openGuide(): void { this.guide.open(); }
}
