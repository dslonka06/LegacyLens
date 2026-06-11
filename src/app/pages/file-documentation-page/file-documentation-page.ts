import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DocumentationSection, DocumentationSectionId, RepositorySummary } from '../../models/repository-summary.model';
import { UserGoalId } from '../../models/guide.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { GuideStateService } from '../../services/guide-state.service';
import { RepositorySummaryService } from '../../services/repository-summary.service';
import { DocumentationBuilderService } from '../../services/documentation-builder.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';

@Component({
  selector: 'app-file-documentation-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ResizeDividerComponent],
  templateUrl: './file-documentation-page.html',
  styleUrl: './file-documentation-page.scss'
})
export class FileDocumentationPage implements OnInit, OnDestroy {

  summary: RepositorySummary | null = null;
  sections: DocumentationSection[] = [];
  selectedIds = new Set<DocumentationSectionId>();
  previewText = '';
  isExporting = false;
  isBuilding = false;
  panelWidths = [320];

  private subs: Subscription[] = [];

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly guide: GuideStateService,
    private readonly summaryService: RepositorySummaryService,
    private readonly builderService: DocumentationBuilderService,
    private readonly pdfExport: PdfExportService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('file-doc') ?? [320];
    this.buildSummary();
    this.subs.push(
      this.currentAnalysis.session$.subscribe(s => { if (s) this.buildSummary(); }),
      this.knowledgeService.knowledge$.subscribe(k => { if (k) this.buildSummary(); }),
      this.currentWorkspace.context$.subscribe(() => this.buildSummary()),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private buildSummary(): void {
    this.isBuilding = true;
    const session = this.currentAnalysis.getSession();
    const workspaceContext = this.currentWorkspace.context;
    const knowledge = this.knowledgeService.knowledge;
    const guideRec = this.guide.recommendation;

    this.summary = this.summaryService.build(workspaceContext, knowledge, session, guideRec);

    const goalId = (guideRec?.primaryGoal ?? null) as UserGoalId | null;
    this.sections = this.builderService.buildSectionList(this.summary, goalId);
    const defaults = this.builderService.defaultSelections(goalId, this.summary);
    this.selectedIds = new Set(defaults);
    this.refreshPreview();
    this.isBuilding = false;
  }

  get hasContent(): boolean { return this.summary !== null; }
  get goalHeadline(): string {
    const goal = this.guide.recommendation?.headline;
    return goal ? `Recommended for: ${goal}` : '';
  }
  get selectedCount(): number { return this.selectedIds.size; }
  get availableCount(): number { return this.sections.filter(s => s.available).length; }
  get workspaceName(): string { return this.summary?.workspaceName ?? 'File'; }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('file-doc', this.panelWidths);
  }

  toggleSection(id: DocumentationSectionId): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.refreshPreview();
  }

  selectAll(): void {
    this.sections.filter(s => s.available).forEach(s => this.selectedIds.add(s.id));
    this.refreshPreview();
  }

  selectNone(): void {
    this.selectedIds.clear();
    this.refreshPreview();
  }

  selectRecommended(): void {
    const goalId = (this.guide.recommendation?.primaryGoal ?? null) as UserGoalId | null;
    const defaults = this.builderService.defaultSelections(goalId, this.summary!);
    this.selectedIds = new Set(defaults);
    this.refreshPreview();
  }

  private refreshPreview(): void {
    if (!this.summary) { this.previewText = ''; return; }
    this.previewText = this.builderService.renderPreview(this.summary, Array.from(this.selectedIds));
  }

  get previewSections(): Array<{ title: string; content: string }> {
    if (!this.previewText) return [];
    return this.previewText.split('\n\n').filter(Boolean).map(block => {
      const lines = block.split('\n');
      return { title: lines[0].replace(/^\d+\.\s*/, ''), content: lines.slice(2).join('\n') };
    });
  }

  async exportPdf(): Promise<void> {
    if (!this.summary || this.isExporting || this.selectedIds.size === 0) return;
    this.isExporting = true;
    try {
      await this.pdfExport.exportDocumentation(this.summary, Array.from(this.selectedIds));
    } finally {
      this.isExporting = false;
    }
  }
}
