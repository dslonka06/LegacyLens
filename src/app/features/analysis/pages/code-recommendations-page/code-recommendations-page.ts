import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import {
  RecommendationAnalysis,
  Recommendation,
} from '@app/analysis/models/recommendation-analysis.model';
import { Workspace } from '@app/workspace/models/workspace-entity.model';
import { FileTreePanel } from '@app/shared/components/file-tree-panel/file-tree-panel';
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

@Component({
  selector: 'app-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, FileTreePanel, CodeEditor, ResizeDividerComponent, ThemeToggle],
  templateUrl: './code-recommendations-page.html',
  styleUrl: './code-recommendations-page.scss',
})
export class CodeRecommendationsPage implements OnInit, OnDestroy {
  workspace: Workspace | null = null;
  get recs(): RecommendationAnalysis | null {
    return this.workspace?.knowledgeModel?.ai?.recommendations ?? null;
  }
  get hasWorkspace(): boolean {
    return this.workspace?.knowledgeModel != null;
  }

  expandedRecs = new Set<string>();
  highlightedFilePath: string | null = null;
  codeEditorWidth = 420;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.codeEditorWidth = this.layoutService.load('recs-code')?.[0] ?? 420;
    this.workspace = this.manager.getActive();
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.workspace = ws;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onCodePanelResize(width: number): void {
    this.codeEditorWidth = width;
    this.layoutService.save('recs-code', [width]);
  }

  get sourceCode(): string | undefined {
    return this.workspace?.knowledgeModel?.structure.sourceCode;
  }

  get sourceFileName(): string | undefined {
    return (
      this.workspace?.knowledgeModel?.structure.filePath ??
      this.workspace?.knowledgeModel?.workspaceName ??
      undefined
    );
  }

  toggleRec(id: string, fileName?: string): void {
    if (this.expandedRecs.has(id)) {
      this.expandedRecs.delete(id);
    } else {
      this.expandedRecs.add(id);
      if (fileName) this.highlightedFilePath = fileName;
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedRecs.has(id);
  }

  get folderTree(): FolderNode | undefined {
    return this.workspace?.knowledgeModel?.structure.folderTree;
  }

  onTreeFileSelected(file: FileNode): void {
    this.highlightedFilePath = file.path;
  }

  priorityClass(rec: Recommendation): string {
    return `priority-${rec.priority}`;
  }

  priorityLabel(rec: Recommendation): string {
    return (
      { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[rec.priority] ??
      rec.priority
    );
  }

  categoryLabel(rec: Recommendation): string {
    return (
      {
        architecture: 'Architecture',
        maintainability: 'Maintainability',
        modernization: 'Modernization',
        reliability: 'Reliability',
        performance: 'Performance',
        complexity: 'Complexity',
        'technical-debt': 'Technical Debt',
      }[rec.category] ?? rec.category
    );
  }

  debtClass(level: string): string {
    return `debt-${level.toLowerCase().replace(' ', '-')}`;
  }

  readinessClass(level: string): string {
    if (level === 'Ready') return 'readiness-ready';
    if (level === 'Partially Ready') return 'readiness-partial';
    return 'readiness-not-ready';
  }
}
