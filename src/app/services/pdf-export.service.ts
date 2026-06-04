import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';

// jspdf is loaded via dynamic import to keep it out of the main bundle.
// The types-only import gives us IntelliSense without a hard bundle dependency.
type JsPDF = import('jspdf').jsPDF;

// ─── Layout constants ────────────────────────────────────
const PAGE_W      = 210;   // A4 mm
const PAGE_H      = 297;
const MARGIN      = 18;
const CONTENT_W   = PAGE_W - MARGIN * 2;
const LINE_H      = 6;     // standard line height (mm)

// ─── Colour palette (dark-on-white — always print-friendly)
const C = {
  brand:       [108,  76, 255] as const,  // #6C4CFF
  text:        [ 17,  24,  39] as const,  // #111827
  muted:       [ 75,  85,  99] as const,  // #4B5563
  subtle:      [156, 163, 175] as const,  // #9CA3AF
  border:      [229, 231, 235] as const,  // #E5E7EB
  high:        [239,  68,  68] as const,  // #EF4444
  medium:      [245, 158,  11] as const,  // #F59E0B
  low:         [ 34, 197,  94] as const,  // #22C55E
  sectionBg:   [248, 250, 252] as const,  // #F8FAFC
};

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  async export(session: AnalysisSession): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const ctx = new RenderContext(doc);
    this.renderCoverHeader(ctx, session);
    this.renderMetadata(ctx, session);
    this.renderSummarySection(ctx, session);
    this.renderArchitectureSection(ctx, session);
    this.renderRisksSection(ctx, session);
    this.renderModernizationsSection(ctx, session);
    this.renderDocumentationSection(ctx, session);
    this.renderFooters(ctx, session);

    const baseName = session.fileName.replace(/\.[^.]+$/, '');
    doc.save(`${baseName}-Analysis.pdf`);
  }

  // ─── Cover header ──────────────────────────────────────
  private renderCoverHeader(ctx: RenderContext, session: AnalysisSession): void {
    const doc = ctx.doc;

    // Brand bar
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, PAGE_W, 28, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('LegacyLens Analysis Report', MARGIN, 12);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 230);
    doc.text('AI-powered legacy code understanding', MARGIN, 20);

    ctx.y = 36;
  }

  // ─── Metadata strip ────────────────────────────────────
  private renderMetadata(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;
    const analysis = session.analysis;
    const date = new Date(session.createdAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const rows = [
      ['File',          session.fileName],
      ['Language',      analysis.language],
      ['Type',          analysis.type],
      ['Complexity',    analysis.complexity],
      ['Maintainability', analysis.maintainability],
      ['Generated',     date],
      ...(ai ? [['AI Model', `${ai.provider} · ${ai.model}`]] : []),
    ];

    ctx.doc.setFillColor(...C.sectionBg);
    ctx.doc.rect(MARGIN, ctx.y, CONTENT_W, rows.length * 7 + 6, 'F');
    ctx.doc.setDrawColor(...C.border);
    ctx.doc.rect(MARGIN, ctx.y, CONTENT_W, rows.length * 7 + 6, 'S');

    ctx.y += 5;
    for (const [key, val] of rows) {
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(...C.muted);
      ctx.doc.text(key, MARGIN + 4, ctx.y);

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setTextColor(...C.text);
      ctx.doc.text(val, MARGIN + 44, ctx.y);

      ctx.y += 7;
    }
    ctx.y += 4;
  }

  // ─── Summary section ───────────────────────────────────
  private renderSummarySection(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;
    const analysis = session.analysis;

    const summary        = ai?.summary         || analysis.summary        || '';
    const businessPurpose = ai?.businessPurpose || analysis.businessPurpose || '';
    const explainSimpler  = ai?.explainSimpler  || analysis.simplifiedExplanation || '';

    ctx.sectionHeader('Summary');
    ctx.subsectionLabel('Plain English Summary');
    ctx.bodyText(summary);
    ctx.gap(3);
    ctx.subsectionLabel('Business Purpose');
    ctx.bodyText(businessPurpose);
    if (explainSimpler) {
      ctx.gap(3);
      ctx.subsectionLabel('Simple Explanation');
      ctx.bodyText(explainSimpler);
    }
  }

  // ─── Architecture section ──────────────────────────────
  private renderArchitectureSection(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;
    const analysis = session.analysis;

    const patterns         = ai?.architecture?.patterns         ?? analysis.patterns        ?? [];
    const responsibilities = ai?.architecture?.responsibilities ?? analysis.responsibilities ?? [];
    const dependencies     = ai?.architecture?.dependencies     ?? analysis.dependencies     ?? [];

    if (!patterns.length && !responsibilities.length && !dependencies.length) return;

    ctx.sectionHeader('Architecture');

    if (patterns.length) {
      ctx.subsectionLabel('Patterns');
      ctx.bulletList(patterns);
    }
    if (responsibilities.length) {
      ctx.subsectionLabel('Responsibilities');
      ctx.bulletList(responsibilities);
    }
    if (dependencies.length) {
      ctx.subsectionLabel('Dependencies');
      ctx.bulletList(dependencies);
    }
  }

  // ─── Risks section ─────────────────────────────────────
  private renderRisksSection(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;

    const risks = ai?.risks?.length
      ? ai.risks.map(r => ({ title: r.title, severity: r.severity, description: r.description }))
      : (session.analysis.risks ?? []).map(r => ({ title: r.description, severity: r.severity, description: r.description }));

    if (!risks.length) return;

    ctx.sectionHeader('Risks & Issues');

    for (const risk of risks) {
      ctx.checkPageBreak(18);

      const sev = risk.severity.toLowerCase();
      const sevColor: readonly [number, number, number] =
        sev === 'high'   ? C.high   :
        sev === 'medium' ? C.medium :
                           C.low;

      // Severity pill
      const pillW = 20;
      ctx.doc.setFillColor(...sevColor);
      ctx.doc.roundedRect(MARGIN, ctx.y, pillW, 5.5, 1, 1, 'F');
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(7);
      ctx.doc.setTextColor(255, 255, 255);
      ctx.doc.text(risk.severity.toUpperCase(), MARGIN + 2, ctx.y + 3.8);

      // Title
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(...C.text);
      ctx.doc.text(risk.title, MARGIN + pillW + 3, ctx.y + 3.8);

      ctx.y += 7;

      // Description (only if different from title)
      if (risk.description !== risk.title) {
        ctx.bodyText(risk.description, 9);
      }
      ctx.y += 2;
    }
  }

  // ─── Modernizations section ────────────────────────────
  private renderModernizationsSection(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;

    const items = ai?.modernizations?.length
      ? ai.modernizations
      : (session.analysis.modernizationSuggestions ?? []).map(m => ({ title: m.description, description: m.description }));

    if (!items.length) return;

    ctx.sectionHeader('Modernization Opportunities');

    for (const item of items) {
      ctx.checkPageBreak(14);

      // Checkmark + title
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(...C.low);
      ctx.doc.text('✓', MARGIN, ctx.y + 1);

      ctx.doc.setTextColor(...C.text);
      const titleLines = ctx.doc.splitTextToSize(item.title, CONTENT_W - 8) as string[];
      ctx.doc.text(titleLines, MARGIN + 6, ctx.y + 1);
      ctx.y += titleLines.length * LINE_H + 1;

      // Description (only if it adds information)
      if (item.description && item.description !== item.title) {
        ctx.bodyText(item.description, 9);
      }
      ctx.y += 2;
    }
  }

  // ─── Documentation section ─────────────────────────────
  private renderDocumentationSection(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;
    const analysis = session.analysis;

    const doc = ai?.documentation;
    const overview        = doc?.overview        || analysis.summary        || '';
    const responsibilities = doc?.responsibilities || analysis.responsibilities?.join('. ') || '';
    const workflow        = doc?.workflow         || analysis.dataFlow       || '';
    const keyDependencies = doc?.keyDependencies  || analysis.dependencies?.join(', ') || '';
    const technicalNotes  = doc?.technicalNotes   || analysis.developerNotes  || '';

    const hasContent = overview || responsibilities || workflow || keyDependencies || technicalNotes;
    if (!hasContent) return;

    ctx.sectionHeader('Documentation');

    if (overview)         { ctx.subsectionLabel('Overview');          ctx.bodyText(overview); ctx.gap(3); }
    if (responsibilities) { ctx.subsectionLabel('Responsibilities');   ctx.bodyText(responsibilities); ctx.gap(3); }
    if (workflow)         { ctx.subsectionLabel('Workflow');           ctx.bodyText(workflow); ctx.gap(3); }
    if (keyDependencies)  { ctx.subsectionLabel('Key Dependencies');   ctx.bodyText(keyDependencies); ctx.gap(3); }
    if (technicalNotes)   { ctx.subsectionLabel('Technical Notes');    ctx.bodyText(technicalNotes); }
  }

  // ─── Page footers ──────────────────────────────────────
  private renderFooters(ctx: RenderContext, session: AnalysisSession): void {
    const totalPages = ctx.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      ctx.doc.setPage(i);
      ctx.doc.setDrawColor(...C.border);
      ctx.doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(7);
      ctx.doc.setTextColor(...C.subtle);
      ctx.doc.text('LegacyLens · AI-powered legacy code understanding', MARGIN, PAGE_H - 7);
      ctx.doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
    }
  }
}

// ─── Rendering context ───────────────────────────────────
// Tracks current Y position and provides helpers for common
// rendering operations, including automatic page breaks.

class RenderContext {
  y = 0;

  constructor(readonly doc: JsPDF) {}

  checkPageBreak(neededMm: number): void {
    if (this.y + neededMm > PAGE_H - 20) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  sectionHeader(title: string): void {
    this.checkPageBreak(16);
    this.y += 4;

    this.doc.setFillColor(...C.brand);
    this.doc.rect(MARGIN, this.y, 3, 7, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(...C.brand);
    this.doc.text(title, MARGIN + 6, this.y + 5.5);

    this.doc.setDrawColor(...C.border);
    this.doc.line(MARGIN, this.y + 9, PAGE_W - MARGIN, this.y + 9);

    this.y += 13;
  }

  subsectionLabel(label: string): void {
    this.checkPageBreak(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...C.muted);
    this.doc.text(label.toUpperCase(), MARGIN, this.y);
    this.y += 5;
  }

  bodyText(text: string, fontSize = 10): void {
    if (!text?.trim()) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...C.text);

    const lines = this.doc.splitTextToSize(text, CONTENT_W) as string[];
    for (const line of lines) {
      this.checkPageBreak(LINE_H + 1);
      this.doc.text(line, MARGIN, this.y);
      this.y += LINE_H;
    }
  }

  bulletList(items: string[]): void {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C.text);

    for (const item of items) {
      this.checkPageBreak(LINE_H + 1);
      this.doc.setTextColor(...C.brand);
      this.doc.text('•', MARGIN + 2, this.y);
      this.doc.setTextColor(...C.text);
      const lines = this.doc.splitTextToSize(item, CONTENT_W - 8) as string[];
      this.doc.text(lines, MARGIN + 7, this.y);
      this.y += lines.length * (LINE_H - 1) + 2;
    }
  }

  gap(mm: number): void {
    this.y += mm;
  }
}
