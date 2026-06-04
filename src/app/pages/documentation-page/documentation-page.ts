import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { GeneratedDocumentation } from '../../models/generated-documentation.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss'
})
export class DocumentationPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

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

  // Each section prefers the AI-generated field; falls back to pattern-based content.
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

  exportPdf(): void {
    window.print();
  }
}
