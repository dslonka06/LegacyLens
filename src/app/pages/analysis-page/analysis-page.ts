import { Component, OnInit } from '@angular/core';
import { CodeEditor } from '../../components/code-editor/code-editor';
import { AnalysisPanel } from '../../components/analysis-panel/analysis-panel';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { HistoryService } from '../../services/history.service';

@Component({
  selector: 'app-analysis-page',
  standalone: true,
  imports: [CodeEditor, AnalysisPanel],
  templateUrl: './analysis-page.html',
  styleUrl: './analysis-page.scss'
})
export class AnalysisPage implements OnInit {

  session: AnalysisSession | null = null;

  // Passed into CodeEditor to restore state
  restoredFileName: string | null = null;
  restoredSourceCode: string | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly history: HistoryService
  ) {}

  ngOnInit(): void {
    const existing = this.currentAnalysis.getSession();
    if (existing) {
      this.session = existing;
      this.restoredFileName = existing.fileName;
      this.restoredSourceCode = existing.sourceCode;
    }
  }

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.currentAnalysis.setSession(session);
    this.history.addSession(session);
  }
}
