import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged } from 'rxjs';
import { DocumentationSection, DocumentationSectionId, RepositorySummary } from '@app/analysis/models/repository-summary.model';
import { CurrentAnalysisService } from '@app/workspace/services/current-analysis.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { RepositoryKnowledgeService } from '@app/knowledge/services/repository-knowledge.service';
import { RepositorySummaryService } from '@app/analysis/services/repository-summary.service';
import { DocumentationBuilderService } from '@app/analysis/services/documentation-builder.service';
import { PdfExportService } from '@app/analysis/services/pdf-export.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';

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
    private readonly summaryService: RepositorySummaryService,
    private readonly builderService: DocumentationBuilderService,
    private readonly pdfExport: PdfExportService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('file-doc') ?? [320];
    this.buildSummary();
    this.subs.push(
      this.knowledgeService.knowledge$.pipe(distinctUntilChanged()).subscribe(k => { if (k) this.buildSummary(); }),
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

    this.summary = this.summaryService.build(workspaceContext, knowledge, session);
    this.sections = this.builderService.buildSectionList(this.summary, 'file');

    if (this.selectedIds.size === 0) {
      const defaults = this.builderService.defaultSelections(this.summary, 'file');
      this.selectedIds = new Set(defaults);
    } else {
      const available = new Set(this.sections.filter(s => s.available).map(s => s.id));
      this.selectedIds = new Set([...this.selectedIds].filter(id => available.has(id)));
    }

    this.refreshPreview();
    this.isBuilding = false;
  }

  get hasContent(): boolean { return this.summary !== null; }
  get selectedCount(): number { return this.selectedIds.size; }
  get availableCount(): number { return this.sections.filter(s => s.available).length; }
  get workspaceName(): string { return this.summary?.workspaceName ?? 'File'; }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('file-doc', this.panelWidths);
  }

  toggleSection(id: DocumentationSectionId): void {
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedIds = next;
    this.refreshPreview();
  }

  selectAll(): void {
    this.selectedIds = new Set(this.sections.filter(s => s.available).map(s => s.id));
    this.refreshPreview();
  }

  selectNone(): void {
    this.selectedIds = new Set();
    this.refreshPreview();
  }

  private refreshPreview(): void {
    if (!this.summary) { this.previewText = ''; return; }
    this.previewText = this.builderService.renderPreview(this.summary, Array.from(this.selectedIds), 'file');
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
      await this.pdfExport.exportDocumentation(this.summary, Array.from(this.selectedIds), 'file');
    } finally {
      this.isExporting = false;
    }
  }
}
