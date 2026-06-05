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

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss'
})
export class DocumentationPage implements OnInit, OnDestroy {

  summary: RepositorySummary | null = null;
  sections: DocumentationSection[] = [];
  selectedIds = new Set<DocumentationSectionId>();
  previewText = '';
  isExporting = false;
  isBuilding = false;

  private subs: Subscription[] = [];

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly guide: GuideStateService,
    private readonly summaryService: RepositorySummaryService,
    private readonly builderService: DocumentationBuilderService,
    private readonly pdfExport: PdfExportService,
  ) {}

  ngOnInit(): void {
    this.buildSummary();

    // Rebuild if knowledge completes after page loads
    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(knowledge => {
        if (knowledge) this.buildSummary();
      }),
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

    // Pre-select recommended (or all available if no guide goal)
    const defaults = this.builderService.defaultSelections(goalId, this.summary);
    this.selectedIds = new Set(defaults);

    this.refreshPreview();
    this.isBuilding = false;
  }

  get hasContent(): boolean {
    return this.summary !== null;
  }

  get goalHeadline(): string {
    const goal = this.guide.recommendation?.headline;
    return goal ? `Recommended for: ${goal}` : '';
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get availableCount(): number {
    return this.sections.filter(s => s.available).length;
  }

  get workspaceName(): string {
    return this.summary?.workspaceName ?? 'Workspace';
  }

  toggleSection(id: DocumentationSectionId): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
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
    return this.previewText.split('\n\n')
      .filter(Boolean)
      .map(block => {
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
