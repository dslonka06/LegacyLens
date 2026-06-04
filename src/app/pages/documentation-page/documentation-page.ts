import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { GeneratedDocumentation } from '../../models/generated-documentation.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { PdfExportService } from '../../services/pdf-export.service';

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss'
})
export class DocumentationPage implements OnInit {

  session: AnalysisSession | null = null;
  isExporting = false;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly pdfExport: PdfExportService
  ) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get isAiPowered(): boolean {
    const doc = this.session?.aiAnalysis?.documentation;
    return !!(doc && doc.overview);
  }

  get doc(): GeneratedDocumentation | null {
    return this.session?.aiAnalysis?.documentation ?? null;
  }

  get overview(): string {
    return this.doc?.overview || this.session?.analysis.summary || '';
  }

  get responsibilities(): string {
    return this.doc?.responsibilities || this.session?.analysis.responsibilities?.join('. ') || '';
  }

  get workflow(): string {
    return this.doc?.workflow || this.session?.analysis.dataFlow || '';
  }

  get keyDependencies(): string {
    return this.doc?.keyDependencies || this.session?.analysis.dependencies?.join(', ') || '';
  }

  get technicalNotes(): string {
    return this.doc?.technicalNotes || this.session?.analysis.developerNotes || '';
  }

  async exportPdf(): Promise<void> {
    if (!this.session || this.isExporting) return;
    this.isExporting = true;
    try {
      await this.pdfExport.export(this.session);
    } finally {
      this.isExporting = false;
    }
  }
}
