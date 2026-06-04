import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Sidebar } from './components/sidebar/sidebar';
import { FeedbackModal } from './components/feedback-modal/feedback-modal';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, FeedbackModal, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  feedbackOpen = false;

  constructor(readonly theme: ThemeService) {}

  openFeedback(): void { this.feedbackOpen = true; }
  closeFeedback(): void { this.feedbackOpen = false; }
}
