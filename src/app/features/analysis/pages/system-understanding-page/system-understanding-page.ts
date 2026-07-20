import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';

@Component({
  selector: 'app-system-understanding-page',
  standalone: true,
  imports: [CommonModule, ExplanationCard, CodeEditor, ResizeDividerComponent, ThemeToggle],
  templateUrl: './system-understanding-page.html',
  styleUrl: './system-understanding-page.scss',
})
export class SystemUnderstandingPage implements OnInit, OnDestroy {
  understanding: SystemUnderstanding | null = null;
  hasWorkspace = false;
  codeEditorWidth = 420;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.codeEditorWidth = this.layoutService.load('understanding-code')?.[0] ?? 420;
    const active = this.manager.getActive();
    this.hasWorkspace = active !== null;
    this.understanding = active?.knowledgeModel?.ai?.understanding ?? null;
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.hasWorkspace = ws !== null;
      this.understanding = ws?.knowledgeModel?.ai?.understanding ?? null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onCodePanelResize(width: number): void {
    this.codeEditorWidth = width;
    this.layoutService.save('understanding-code', [width]);
  }

  get sourceCode(): string | undefined {
    return this.manager.getActive()?.knowledgeModel?.structure.sourceCode;
  }

  get sourceFileName(): string | undefined {
    return (
      this.manager.getActive()?.knowledgeModel?.structure.filePath ??
      this.manager.getActive()?.knowledgeModel?.workspaceName ??
      undefined
    );
  }

  get showExplanationCard(): boolean {
    return this.hasWorkspace && this.understanding !== null;
  }

  depTypeLabel(type: string): string {
    const map: Record<string, string> = {
      framework: 'Framework',
      database: 'Database',
      queue: 'Queue',
      storage: 'Storage',
      external: 'External',
      internal: 'Internal',
    };
    return map[type] ?? type;
  }
}
