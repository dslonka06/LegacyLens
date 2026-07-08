import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import { AnalysisPanel } from '@app/shared/components/analysis-panel/analysis-panel';
import { WorkspacePanel } from '@app/workspace/components/workspace-panel/workspace-panel';
import { WorkspaceSwitcherModal } from '@app/workspace/components/workspace-switcher-modal/workspace-switcher-modal';
import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceProfile } from '@app/workspace/models/workspace.model';
import { WorkspaceContext } from '@app/workspace/models/workspace-context.model';
import { CurrentAnalysisService } from '@app/workspace/services/current-analysis.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { SecurityAnalysisService } from '@app/analysis/services/security-analysis.service';
import { SystemUnderstandingService } from '@app/analysis/services/system-understanding.service';
import { RecommendationAnalysisService } from '@app/analysis/services/recommendation-analysis.service';
import { LearningPathAnalysisService } from '@app/analysis/services/learning-path-analysis.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { AiKnowledgeService } from '@app/ai/services/ai-knowledge.service';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';

@Component({
  selector: 'app-file-analysis-page',
  standalone: true,
  imports: [CommonModule, CodeEditor, AnalysisPanel, WorkspacePanel, WorkspaceSwitcherModal, ResizeDividerComponent],
  templateUrl: './file-analysis-page.html',
  styleUrl: './file-analysis-page.scss'
})
export class FileAnalysisPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  workspaceProfile: WorkspaceProfile | null = null;
  workspaceContext: WorkspaceContext | null = null;

  restoredFileName: string | null = null;
  restoredSourceCode: string | null = null;

  showSwitcher = false;
  switcherLimitReached = false;

  // Panel widths: [0] = editor column
  panelWidths = [480];

  private contextSub: Subscription | null = null;
  private limitSub: Subscription | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly manager: WorkspaceManagerService,
    private readonly securityService: SecurityAnalysisService,
    private readonly understandingService: SystemUnderstandingService,
    private readonly recService: RecommendationAnalysisService,
    private readonly learningPathService: LearningPathAnalysisService,
    private readonly layoutService: PanelLayoutService,
    private readonly aiKnowledge: AiKnowledgeService,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('file-analysis') ?? [480];
    const existing = this.currentAnalysis.getSession();
    if (existing) {
      this.session = existing;
      this.restoredFileName = existing.fileName;
      this.restoredSourceCode = existing.sourceCode;
      this.workspaceProfile = existing.workspaceContext ?? null;
    }

    this.workspaceContext = this.currentWorkspace.context;
    if (this.workspaceContext) {
      this.workspaceProfile = this.workspaceContext.profile;
    }

    this.contextSub = this.currentWorkspace.context$.subscribe(ctx => {
      this.workspaceContext = ctx;
    });

    this.limitSub = this.manager.limitReached$.subscribe(() => this.openSwitcher());
  }

  ngOnDestroy(): void {
    this.contextSub?.unsubscribe();
    this.limitSub?.unsubscribe();
  }

  async onSessionCreated(session: AnalysisSession): Promise<void> {
    this.session = session;
    this.restoredFileName = session.fileName;
    this.restoredSourceCode = session.sourceCode;
    this.currentAnalysis.setSession(session);

    const id = this.manager.activeId;
    if (id) {
      this.manager.rename(id, session.fileName);
      const security = await this.securityService.analyzeFile(session);
      this.manager.setSecurityAnalysis(id, security);
      const understanding = await this.understandingService.analyzeFile(session);
      this.manager.setSystemUnderstanding(id, understanding);
      const recs = await this.recService.analyzeFile(session);
      this.manager.setRecommendationAnalysis(id, recs);
      const ws = this.manager.getById(id);
      if (ws?.systemUnderstanding) {
        const lp = await this.learningPathService.analyzeFile(session, ws.systemUnderstanding);
        this.manager.setLearningPathAnalysis(id, lp);
      }

      const ctx = this.currentWorkspace.context;
      if (ctx) {
        this.aiKnowledge.generateSecurityOverview(ctx, security, 'file').subscribe({
          next: overview => this.manager.setSecurityOverview(id, overview),
          error: () => { /* AI unavailable — overview stays null, page degrades gracefully */ },
        });
      }

      const aiSummary = session.aiAnalysis?.summary;
      if (aiSummary) {
        this.manager.setAiExplanation(id, {
          type: 'repository',
          title: 'File Intelligence',
          content: aiSummary,
          generatedAt: new Date().toISOString(),
        });
      }
    }
  }

  onWorkspaceReady(profile: WorkspaceProfile | null): void {
    this.workspaceProfile = profile;
  }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('file-analysis', this.panelWidths);
  }

  openSwitcher(): void {
    this.switcherLimitReached = !this.manager.canCreate();
    this.showSwitcher = true;
  }

  closeSwitcher(): void {
    this.showSwitcher = false;
    this.switcherLimitReached = false;
  }
}
