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
import { WorkspaceKnowledgeService } from '@app/knowledge/services/workspace-knowledge.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import type { ElectronDirectoryEntry } from '../../../../../electron';

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
    private readonly workspaceKnowledge: WorkspaceKnowledgeService,
    private readonly layoutService: PanelLayoutService,
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

  onSessionCreated(session: AnalysisSession): void {
    this.session = session;
    this.restoredFileName = session.fileName;
    this.restoredSourceCode = session.sourceCode;
    this.currentAnalysis.setSession(session);

    const id = this.manager.activeId;
    if (id) {
      this.manager.rename(id, session.fileName);
      // AI analysis is now handled by AIAnalysisService via WorkspaceKnowledgeService
    }
  }

  onWorkspaceReady(profile: WorkspaceProfile | null): void {
    this.workspaceProfile = profile;
  }

  onFilesUploaded(files: File[]): void {
    this.triggerKnowledgePipeline(files);
  }

  private triggerKnowledgePipeline(files: File[]): void {
    const id = this.manager.activeId;
    if (!id || files.length === 0) return;

    this.filesToEntries(files).then(entries => {
      this.workspaceKnowledge.process('file', entries, {
        workspaceId:   id,
        workspaceName: files[0]?.name ?? 'file',
        persist:       false,
      }).subscribe({
        error: () => { /* pipeline errors handled by manager.setError */ },
      });
    });
  }

  private filesToEntries(files: File[]): Promise<ElectronDirectoryEntry[]> {
    return Promise.all(
      files.map(f => new Promise<ElectronDirectoryEntry>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name:         f.name,
          relativePath: (f as any).webkitRelativePath || f.name,
          content:      reader.result as string,
          size:         f.size,
          modifiedAt:   new Date(f.lastModified).toISOString(),
        });
        reader.onerror = () => resolve({
          name:         f.name,
          relativePath: (f as any).webkitRelativePath || f.name,
          content:      null,
          size:         f.size,
          modifiedAt:   new Date(f.lastModified).toISOString(),
        });
        reader.readAsText(f);
      }))
    );
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
