import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  DocumentationSection,
  DocumentationSectionId,
} from '@app/analysis/models/repository-summary.model';
import { DocumentationBuilderService } from '@app/analysis/services/documentation-builder.service';
import { PdfExportService } from '@app/analysis/services/pdf-export.service';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, ResizeDividerComponent, ThemeToggle],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss',
})
export class DocumentationPage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  sections: DocumentationSection[] = [];
  selectedIds = new Set<DocumentationSectionId>();
  previewText = '';
  isExporting = false;
  isExportingPrint = false;
  panelWidths = [320];

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly builder: DocumentationBuilderService,
    private readonly pdfExport: PdfExportService,
    private readonly layoutService: PanelLayoutService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('documentation') ?? [320];

    this.model = this.manager.getActive()?.knowledgeModel ?? null;
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prev = this.model;
      this.model = ws?.knowledgeModel ?? null;

      if (this.model) {
        this.sections = this.builder.buildSectionList(this.model);

        if (!prev || this.selectedIds.size === 0) {
          this.selectedIds = new Set(this.builder.defaultSelections(this.model));
        } else {
          const available = new Set(this.sections.filter((s) => s.available).map((s) => s.id));
          this.selectedIds = new Set([...this.selectedIds].filter((id) => available.has(id)));
        }

        this.refreshPreview();
      } else {
        this.sections = [];
        this.selectedIds = new Set();
        this.previewText = '';
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── Section selection ─────────────────────────────────────────────────────────

  toggleSection(id: DocumentationSectionId): void {
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds = next;
    this.refreshPreview();
  }

  selectAll(): void {
    this.selectedIds = new Set(this.sections.filter((s) => s.available).map((s) => s.id));
    this.refreshPreview();
  }

  selectNone(): void {
    this.selectedIds = new Set();
    this.refreshPreview();
  }

  private refreshPreview(): void {
    if (!this.model) {
      this.previewText = '';
      return;
    }
    this.previewText = this.builder.renderPreview(this.model, Array.from(this.selectedIds));
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  async exportPdf(): Promise<void> {
    if (!this.model || this.isExporting || this.selectedIds.size === 0) return;
    this.isExporting = true;
    try {
      await this.pdfExport.exportFromModel(this.model, Array.from(this.selectedIds));
    } finally {
      this.isExporting = false;
    }
  }

  async exportPrintPdf(): Promise<void> {
    if (!this.model || this.isExportingPrint || this.selectedIds.size === 0) return;
    this.isExportingPrint = true;
    try {
      await this.pdfExport.exportFromModel(this.model, Array.from(this.selectedIds), 'print');
    } finally {
      this.isExportingPrint = false;
    }
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => (i === index ? width : w));
    this.layoutService.save('documentation', this.panelWidths);
  }

  // ── Display helpers ───────────────────────────────────────────────────────────

  get hasContent(): boolean {
    return this.model != null;
  }
  get selectedCount(): number {
    return this.selectedIds.size;
  }
  get availableCount(): number {
    return this.sections.filter((s) => s.available).length;
  }

  get workspaceName(): string {
    return this.model?.workspaceName ?? 'Workspace';
  }

  get previewSections(): Array<{ title: string; content: string }> {
    if (!this.previewText) return [];
    // Split on lines that start a new numbered section (e.g. "1. Executive Summary").
    // Using a lookahead keeps the delimiter line inside each chunk.
    const chunks = this.previewText.split(/(?=^\d+\. )/m).filter(Boolean);
    return chunks.map((chunk) => {
      const newline = chunk.indexOf('\n');
      const title = (newline === -1 ? chunk : chunk.slice(0, newline)).replace(/^\d+\.\s*/, '').trim();
      const content = newline === -1 ? '' : chunk.slice(newline + 1).trim();
      return { title, content };
    });
  }
}
