import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, ResizeDividerComponent, CodeEditor],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss',
})
export class DocumentationPage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  sections: DocumentationSection[] = [];
  selectedIds = new Set<DocumentationSectionId>();
  previewText = '';
  isExporting = false;
  panelWidths = [320];
  codeEditorWidth = 420;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly builder: DocumentationBuilderService,
    private readonly pdfExport: PdfExportService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('documentation') ?? [320];
    this.codeEditorWidth = this.layoutService.load('documentation-code')?.[0] ?? 420;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      const prev = this.model;
      this.model = ws?.knowledgeModel ?? null;

      if (this.model) {
        this.sections = this.builder.buildSectionList(this.model);

        if (!prev || this.selectedIds.size === 0) {
          // First load — apply defaults
          this.selectedIds = new Set(this.builder.defaultSelections(this.model));
        } else {
          // Subsequent update (AI stage arrived) — keep selections, drop unavailable
          const available = new Set(this.sections.filter((s) => s.available).map((s) => s.id));
          this.selectedIds = new Set([...this.selectedIds].filter((id) => available.has(id)));
        }

        this.refreshPreview();
      } else {
        this.sections = [];
        this.selectedIds = new Set();
        this.previewText = '';
      }
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

  // ── Panel ─────────────────────────────────────────────────────────────────────

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => (i === index ? width : w));
    this.layoutService.save('documentation', this.panelWidths);
  }

  onCodePanelResize(width: number): void {
    this.codeEditorWidth = width;
    this.layoutService.save('documentation-code', [width]);
  }

  get sourceCode(): string | undefined {
    return this.model?.structure.sourceCode;
  }

  get sourceFileName(): string | undefined {
    return this.model?.structure.filePath ?? this.model?.workspaceName ?? undefined;
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
    return this.previewText
      .split('\n\n')
      .filter(Boolean)
      .map((block) => {
        const lines = block.split('\n');
        return { title: lines[0].replace(/^\d+\.\s*/, ''), content: lines.slice(2).join('\n') };
      });
  }
}
