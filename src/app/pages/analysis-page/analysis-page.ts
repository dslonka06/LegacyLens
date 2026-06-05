import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CodeEditor } from '../../components/code-editor/code-editor';
import { AnalysisPanel } from '../../components/analysis-panel/analysis-panel';
import { WorkspaceSummary } from '../../components/workspace-summary/workspace-summary';
import { RepositoryPreview } from '../../components/repository-preview/repository-preview';
import { RepositoryIntelligence } from '../../components/repository-intelligence/repository-intelligence';
import { AnalysisSession } from '../../models/analysis-session.model';
import { WorkspaceProfile } from '../../models/workspace.model';
import { KnowledgeState, RepositoryKnowledge } from '../../models/knowledge.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { HistoryService } from '../../services/history.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';

@Component({
  selector: 'app-analysis-page',
  standalone: true,
  imports: [CommonModule, CodeEditor, AnalysisPanel, WorkspaceSummary, RepositoryPreview, RepositoryIntelligence],
  templateUrl: './analysis-page.html',
  styleUrl: './analysis-page.scss'
})
export class AnalysisPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  workspaceProfile: WorkspaceProfile | null = null;
  repositoryKnowledge: RepositoryKnowledge | null = null;
  knowledgeState: KnowledgeState = KnowledgeState.NotStarted;

  restoredFileName: string | null = null;
  restoredSourceCode: string | null = null;

  private stateSub: Subscription | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly history: HistoryService,
    readonly knowledgeService: RepositoryKnowledgeService,
  ) {}

  ngOnInit(): void {
    const existing = this.currentAnalysis.getSession();
    if (existing) {
      this.session = existing;
      this.restoredFileName = existing.fileName;
      this.restoredSourceCode = existing.sourceCode;
      this.workspaceProfile = existing.workspaceContext ?? null;
    }

    // Keep local state in sync with the knowledge service for progress display
    this.stateSub = this.knowledgeService.state$.subscribe(state => {
      this.knowledgeState = state;
    });

    // Restore knowledge if it survived navigation (service is singleton)
    this.repositoryKnowledge = this.knowledgeService.knowledge;
  }

  ngOnDestroy(): void {
    this.stateSub?.unsubscribe();
  }

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.currentAnalysis.setSession(session);
    this.history.addSession(session);
  }

  onWorkspaceReady(profile: WorkspaceProfile | null): void {
    this.workspaceProfile = profile;
    if (!profile) {
      this.repositoryKnowledge = null;
      this.knowledgeState = KnowledgeState.NotStarted;
    }
  }

  onKnowledgeReady(knowledge: RepositoryKnowledge): void {
    this.repositoryKnowledge = knowledge;
  }

  get showWorkspacePanels(): boolean {
    return this.workspaceProfile !== null;
  }

  get showIntelligence(): boolean {
    return this.knowledgeState !== KnowledgeState.NotStarted;
  }
}
