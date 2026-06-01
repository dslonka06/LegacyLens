import { Component } from '@angular/core';
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
export class AnalysisPage {

  session: AnalysisSession | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly history: HistoryService
  ) {}

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.currentAnalysis.setSession(session);
    this.history.addSession(session);
  }
}
