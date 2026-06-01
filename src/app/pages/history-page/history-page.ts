import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { HistoryService } from '../../services/history.service';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss'
})
export class HistoryPage implements OnInit {

  sessions: AnalysisSession[] = [];

  constructor(
    private readonly history: HistoryService,
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.sessions = this.history.getSessions();
  }

  restoreSession(index: number): void {
    const session = this.history.getSessionByIndex(index);
    if (session) {
      this.currentAnalysis.setSession(session);
      this.router.navigate(['/analysis']);
    }
  }

  deleteSession(index: number): void {
    this.history.deleteSession(index);
    this.sessions = this.history.getSessions();
  }

  clearHistory(): void {
    this.history.clearHistory();
    this.sessions = [];
  }
}
