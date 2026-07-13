import { Injectable } from '@angular/core';
import { PdfExportService } from './pdf-export.service';
import { DocumentationBuilderService } from './documentation-builder.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

export type ExportFormat = 'pdf' | 'json';

/**
 * ExportService — pluggable exporter router.
 *
 * Routes export requests to the appropriate exporter by format.
 * Adding a new format means adding a case here and an exporter service — no pages change.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  constructor(
    private readonly pdf: PdfExportService,
    private readonly builder: DocumentationBuilderService,
  ) {}

  async export(format: ExportFormat, model: KnowledgeModel): Promise<void> {
    switch (format) {
      case 'pdf':
        await this.exportPdf(model);
        break;
      case 'json':
        this.exportJson(model);
        break;
    }
  }

  private async exportPdf(model: KnowledgeModel): Promise<void> {
    const ids = this.builder.defaultSelections(model);
    await this.pdf.exportFromModel(model, ids);
  }

  private exportJson(model: KnowledgeModel): void {
    const name = model.workspaceName ?? 'knowledge-model';
    const fileName = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}-knowledge.json`;
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
