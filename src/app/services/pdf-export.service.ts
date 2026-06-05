import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { DocumentationSectionId, RepositorySummary } from '../models/repository-summary.model';
import { DocumentationBuilderService } from './documentation-builder.service';

type JsPDF = import('jspdf').jsPDF;

// ─── Page geometry ───────────────────────────────────────
const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H  = 16;   // reserved at bottom of every page
const BODY_LH   = 5.8;  // body line height (mm)
const SMALL_LH  = 5.2;

// ─── Colour palette ──────────────────────────────────────
const C = {
  brand:     [108,  76, 255] as const,
  brandDark: [ 80,  55, 200] as const,
  text:      [ 17,  24,  39] as const,
  muted:     [ 75,  85,  99] as const,
  subtle:    [156, 163, 175] as const,
  border:    [226, 232, 240] as const,
  pageBg:    [248, 250, 252] as const,
  high:      [220,  38,  38] as const,
  medium:    [217, 119,   6] as const,
  lowGreen:  [ 22, 163,  74] as const,
  white:     [255, 255, 255] as const,
};

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  constructor(private readonly builder: DocumentationBuilderService) {}

  // ── New: export selected documentation sections from RepositorySummary ──
  async exportDocumentation(
    summary: RepositorySummary,
    selectedIds: DocumentationSectionId[],
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ctx = new RenderContext(doc);

    this.renderDocumentationCover(ctx, summary);

    const rendered = this.builder.renderPreview(summary, selectedIds);
    const sections = rendered.split('\n\n').filter(Boolean);

    for (const block of sections) {
      const lines = block.split('\n');
      const headerLine = lines[0];
      const ruleLine   = lines[1];
      const bodyLines  = lines.slice(2);

      // Section header (numbered title)
      ctx.sectionHeader(headerLine.replace(/^\d+\.\s*/, ''));
      for (const line of bodyLines) {
        if (!line.trim()) { ctx.spacer(3); continue; }
        if (line.startsWith('•')) {
          ctx.bulletList([line.replace(/^•\s*/, '')]);
        } else if (/^\[(\w+)\]/.test(line)) {
          // Risk/insight severity line
          const sev = (line.match(/^\[(\w+)\]/) ?? [])[1]?.toLowerCase() ?? 'low';
          ctx.fieldLabel(line.replace(/^\[\w+\]\s*/, ''));
        } else if (line.startsWith('  ')) {
          ctx.body(line.trim(), 9);
        } else {
          ctx.body(line, 9.5);
        }
      }
      ctx.spacer(4);
    }

    this.renderDocumentationMetadata(ctx, summary);
    this.renderFooters(ctx);

    const safeName = summary.workspaceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    doc.save(`${safeName}-Documentation.pdf`);
  }

  private renderDocumentationCover(ctx: RenderContext, summary: RepositorySummary): void {
    const doc = ctx.doc;
    const cx  = PAGE_W / 2;

    const HEADER_H = 72;
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
    doc.setFillColor(...C.brandDark);
    doc.rect(0, HEADER_H - 2, PAGE_W, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.white);
    doc.text('LEGACYLENS DOCUMENTATION', cx, 22, { align: 'center' });

    doc.setDrawColor(160, 140, 255);
    doc.setLineWidth(0.4);
    doc.line(cx - 45, 26, cx + 45, 26);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(230, 225, 255);
    const nameLines = doc.splitTextToSize(summary.workspaceName, CONTENT_W - 10) as string[];
    doc.text(nameLines[0], cx, 38, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(190, 185, 235);
    const date = new Date(summary.generatedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    doc.text(date, cx, 49, { align: 'center' });
    doc.text(`${summary.workspaceType} · ${summary.totalFiles} files`, cx, 57, { align: 'center' });

    ctx.y = HEADER_H + 14;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ctx.y - 4, PAGE_W - MARGIN, ctx.y - 4);
  }

  private renderDocumentationMetadata(ctx: RenderContext, summary: RepositorySummary): void {
    ctx.checkPage(40);
    ctx.spacer(10);
    ctx.sectionHeader('Document Metadata');
    ctx.fieldLabel('Repository');
    ctx.body(summary.workspaceName);
    ctx.spacer(4);
    ctx.fieldLabel('Workspace Type');
    ctx.body(summary.workspaceType);
    ctx.spacer(4);
    ctx.fieldLabel('Generated');
    ctx.body(new Date(summary.generatedAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }));
    if (summary.technologies.length) {
      ctx.spacer(4);
      ctx.fieldLabel('Technologies');
      ctx.body(summary.technologies.slice(0, 10).join(', '));
    }
    ctx.spacer(4);
    ctx.fieldLabel('Generated By');
    ctx.body('LegacyLens — AI-Powered Legacy Code Understanding');
  }

  async export(session: AnalysisSession): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const ctx = new RenderContext(doc);
    this.renderCover(ctx, session);
    this.renderSummary(ctx, session);
    this.renderArchitecture(ctx, session);
    this.renderRisks(ctx, session);
    this.renderModernizations(ctx, session);
    this.renderDocumentation(ctx, session);
    this.renderFooters(ctx);

    const base = session.fileName.replace(/\.[^.]+$/, '');
    doc.save(`${base}-Analysis.pdf`);
  }

  // ─── Cover / header ──────────────────────────────────────
  // Occupies ~25% of page 1. Centered, consulting-style.
  private renderCover(ctx: RenderContext, session: AnalysisSession): void {
    const doc   = ctx.doc;
    const cx    = PAGE_W / 2;   // horizontal center
    const ai    = session.aiAnalysis;

    // ── Purple background block (~25% of page height) ──
    const HEADER_H = 72;
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

    // Bottom accent stripe
    doc.setFillColor(...C.brandDark);
    doc.rect(0, HEADER_H - 2, PAGE_W, 2, 'F');

    // ── Report title — largest text, centered ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...C.white);
    doc.text('LEGACYLENS ANALYSIS REPORT', cx, 22, { align: 'center' });

    // ── Thin rule beneath title ──
    doc.setDrawColor(160, 140, 255);
    doc.setLineWidth(0.4);
    const ruleW = 90;
    doc.line(cx - ruleW / 2, 26, cx + ruleW / 2, 26);

    // ── File name — prominent, centered ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(230, 225, 255);
    // Truncate very long file names so they stay on one line
    const maxFileW = CONTENT_W - 10;
    const fileLines = doc.splitTextToSize(session.fileName, maxFileW) as string[];
    doc.text(fileLines[0], cx, 38, { align: 'center' });

    // ── AI provider / model line ──
    const modelLine = ai
      ? `Generated by ${ai.provider} ${ai.model}`
      : 'Generated by LegacyLens Pattern Analysis';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(190, 185, 235);
    doc.text(modelLine, cx, 49, { align: 'center' });

    // ── Generated date ──
    const date = new Date(session.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    doc.setFontSize(9);
    doc.setTextColor(190, 185, 235);
    doc.text(date, cx, 57, { align: 'center' });

    // ── Horizontal divider below the purple block ──
    ctx.y = HEADER_H + 10;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
    ctx.y += 10;

    // ── File metadata box ──
    const analysis = session.analysis;
    const metaDate = new Date(session.createdAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const rows: [string, string][] = [
      ['File',            session.fileName],
      ['Language',        analysis.language],
      ['Type',            analysis.type],
      ['Complexity',      analysis.complexity],
      ['Maintainability', analysis.maintainability],
      ['Generated',       metaDate],
    ];
    if (ai) rows.push(['AI Model', `${ai.provider} / ${ai.model}`]);

    const rowH    = 7.5;
    const boxH    = rows.length * rowH + 8;
    const labelX  = MARGIN + 5;
    const valueX  = MARGIN + 52;

    doc.setFillColor(...C.pageBg);
    doc.setDrawColor(...C.border);
    doc.roundedRect(MARGIN, ctx.y, CONTENT_W, boxH, 2, 2, 'FD');

    ctx.y += 6;
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(label.toUpperCase(), labelX, ctx.y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      // Truncate long values to fit the box
      const maxW  = CONTENT_W - (valueX - MARGIN) - 5;
      const lines = doc.splitTextToSize(value, maxW) as string[];
      doc.text(lines[0], valueX, ctx.y);

      ctx.y += rowH;
    }
    ctx.y += 8;
  }

  // ─── Summary ─────────────────────────────────────────────
  private renderSummary(ctx: RenderContext, session: AnalysisSession): void {
    const ai  = session.aiAnalysis;
    const ana = session.analysis;

    const summary  = ai?.summary          || ana.summary                  || '';
    const business = ai?.businessPurpose  || ana.businessPurpose          || '';
    const simpler  = ai?.explainSimpler   || ana.simplifiedExplanation    || '';

    ctx.sectionHeader('Summary');
    ctx.fieldLabel('Plain English Summary');
    ctx.body(summary);
    ctx.spacer(5);
    ctx.fieldLabel('Business Purpose');
    ctx.body(business);
    if (simpler) {
      ctx.spacer(5);
      ctx.fieldLabel('Simple Explanation');
      ctx.body(simpler);
    }
  }

  // ─── Architecture ─────────────────────────────────────────
  private renderArchitecture(ctx: RenderContext, session: AnalysisSession): void {
    const ai  = session.aiAnalysis;
    const ana = session.analysis;

    const patterns  = ai?.architecture?.patterns         ?? ana.patterns        ?? [];
    const resps     = ai?.architecture?.responsibilities ?? ana.responsibilities ?? [];
    const deps      = ai?.architecture?.dependencies     ?? ana.dependencies     ?? [];

    if (!patterns.length && !resps.length && !deps.length) return;

    ctx.sectionHeader('Architecture');
    if (patterns.length) { ctx.fieldLabel('Patterns');         ctx.bulletList(patterns); ctx.spacer(4); }
    if (resps.length)    { ctx.fieldLabel('Responsibilities');  ctx.bulletList(resps);    ctx.spacer(4); }
    if (deps.length)     { ctx.fieldLabel('Dependencies');      ctx.bulletList(deps); }
  }

  // ─── Risks ────────────────────────────────────────────────
  private renderRisks(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;

    const risks = ai?.risks?.length
      ? ai.risks.map(r => ({ title: r.title, severity: r.severity, description: r.description }))
      : (session.analysis.risks ?? []).map(r => ({
          title: r.description, severity: r.severity, description: r.description
        }));

    if (!risks.length) return;

    ctx.sectionHeader('Risks & Issues');

    for (const risk of risks) {
      // Pre-compute line counts so we can reserve space before drawing anything
      const pillW = 16;
      const pillH = 6;
      const titleAvailW = CONTENT_W - pillW - 6;
      const descAvailW  = CONTENT_W - pillW - 6;

      // Measure title and description before touching ctx.y
      ctx.doc.setFontSize(9.5);
      const titleLines = ctx.doc.splitTextToSize(risk.title, titleAvailW) as string[];

      const hasDesc = !!(risk.description && risk.description !== risk.title);
      ctx.doc.setFontSize(9);
      const descLines: string[] = hasDesc
        ? ctx.doc.splitTextToSize(risk.description, descAvailW) as string[]
        : [];

      // Total height = badge/title row + optional description + bottom gap
      const titleRowH = Math.max(pillH, titleLines.length * SMALL_LH + 2);
      const descH     = hasDesc ? descLines.length * BODY_LH + 2 : 0;
      const totalH    = titleRowH + descH + 6;

      ctx.checkPage(totalH);

      const sev = risk.severity.toLowerCase();
      const sevColor: [number, number, number] =
        sev === 'high'   ? [C.high[0],     C.high[1],     C.high[2]]   :
        sev === 'medium' ? [C.medium[0],   C.medium[1],   C.medium[2]] :
                           [C.lowGreen[0], C.lowGreen[1], C.lowGreen[2]];

      // ── Draw severity pill ──
      ctx.doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
      ctx.doc.roundedRect(MARGIN, ctx.y, pillW, pillH, 1.5, 1.5, 'F');
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(6.5);
      ctx.doc.setTextColor(...C.white);
      ctx.doc.text(
        risk.severity.toUpperCase(),
        MARGIN + pillW / 2,
        ctx.y + pillH / 2 + 1.2,
        { align: 'center' }
      );

      // ── Draw title — vertically centered with the pill ──
      const titleX    = MARGIN + pillW + 4;
      const titleBaseY = ctx.y + pillH / 2 + 1.5;  // baseline of first line, aligned to pill center
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9.5);
      ctx.doc.setTextColor(...C.text);
      ctx.doc.text(titleLines, titleX, titleBaseY);

      // Advance past the entire title/badge row — use the measured titleRowH
      ctx.y += titleRowH + 2;

      // ── Draw description ──
      if (hasDesc) {
        ctx.doc.setFont('helvetica', 'normal');
        ctx.doc.setFontSize(9);
        ctx.doc.setTextColor(...C.muted);
        for (const line of descLines) {
          ctx.checkPage(BODY_LH + 1);
          ctx.doc.text(line, MARGIN + pillW + 4, ctx.y);
          ctx.y += BODY_LH;
        }
      }

      ctx.y += 6;  // gap between risk entries
    }
  }

  // ─── Modernizations ───────────────────────────────────────
  private renderModernizations(ctx: RenderContext, session: AnalysisSession): void {
    const ai = session.aiAnalysis;

    const items = ai?.modernizations?.length
      ? ai.modernizations
      : (session.analysis.modernizationSuggestions ?? []).map(m => ({
          title: m.description, description: m.description
        }));

    if (!items.length) return;

    ctx.sectionHeader('Modernization Opportunities');

    for (const item of items) {
      ctx.checkPage(18);

      // Dash prefix — ASCII, renders reliably in all jspdf built-in fonts
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9.5);
      ctx.doc.setTextColor(...C.brand);
      ctx.doc.text('-', MARGIN, ctx.y);

      ctx.doc.setTextColor(...C.text);
      const titleLines = ctx.doc.splitTextToSize(item.title, CONTENT_W - 7) as string[];
      ctx.doc.text(titleLines, MARGIN + 5, ctx.y);
      ctx.y += titleLines.length * SMALL_LH + 1;

      if (item.description && item.description !== item.title) {
        ctx.doc.setFont('helvetica', 'normal');
        ctx.doc.setFontSize(9);
        ctx.doc.setTextColor(...C.muted);
        const descLines = ctx.doc.splitTextToSize(item.description, CONTENT_W - 7) as string[];
        for (const line of descLines) {
          ctx.checkPage(BODY_LH + 1);
          ctx.doc.text(line, MARGIN + 5, ctx.y);
          ctx.y += BODY_LH;
        }
      }
      ctx.y += 5;
    }
  }

  // ─── Documentation ────────────────────────────────────────
  private renderDocumentation(ctx: RenderContext, session: AnalysisSession): void {
    const ai  = session.aiAnalysis;
    const ana = session.analysis;
    const d   = ai?.documentation;

    const overview  = d?.overview        || ana.summary                  || '';
    const resps     = d?.responsibilities || ana.responsibilities?.join('. ') || '';
    const workflow  = d?.workflow         || ana.dataFlow                 || '';
    const deps      = d?.keyDependencies  || ana.dependencies?.join(', ') || '';
    const notes     = d?.technicalNotes   || ana.developerNotes           || '';

    if (!overview && !resps && !workflow && !deps && !notes) return;

    ctx.sectionHeader('Documentation');
    if (overview) { ctx.fieldLabel('Overview');          ctx.body(overview); ctx.spacer(5); }
    if (resps)    { ctx.fieldLabel('Responsibilities');  ctx.body(resps);    ctx.spacer(5); }
    if (workflow) { ctx.fieldLabel('Workflow');          ctx.body(workflow); ctx.spacer(5); }
    if (deps)     { ctx.fieldLabel('Key Dependencies');  ctx.body(deps);     ctx.spacer(5); }
    if (notes)    { ctx.fieldLabel('Technical Notes');   ctx.body(notes); }
  }

  // ─── Page footers (written last so page count is correct) ─
  private renderFooters(ctx: RenderContext): void {
    const total = ctx.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      ctx.doc.setPage(i);

      // Separator line
      ctx.doc.setDrawColor(...C.border);
      ctx.doc.setLineWidth(0.3);
      ctx.doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H);

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(7);
      ctx.doc.setTextColor(...C.subtle);

      // Left: brand text
      ctx.doc.text(
        'LegacyLens  |  AI-Powered Legacy Code Understanding',
        MARGIN, PAGE_H - 9
      );

      // Right: page number
      ctx.doc.text(
        `Page ${i} of ${total}`,
        PAGE_W - MARGIN, PAGE_H - 9,
        { align: 'right' }
      );
    }
  }
}

// ─── Rendering context ────────────────────────────────────
class RenderContext {
  y = 0;

  constructor(readonly doc: JsPDF) {}

  // Remaining printable height on current page
  private remaining(): number {
    return PAGE_H - FOOTER_H - this.y;
  }

  checkPage(neededMm: number): void {
    if (this.remaining() < neededMm) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  // Bold coloured section header with left accent bar and rule beneath
  sectionHeader(title: string): void {
    this.checkPage(20);
    this.y += 6;

    // Left accent bar
    this.doc.setFillColor(...C.brand);
    this.doc.rect(MARGIN, this.y, 3.5, 8, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(13);
    this.doc.setTextColor(...C.brand);
    this.doc.text(title, MARGIN + 7, this.y + 6);

    // Underrule
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN, this.y + 10, PAGE_W - MARGIN, this.y + 10);

    this.y += 16;
  }

  // Small uppercased field label
  fieldLabel(label: string): void {
    this.checkPage(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...C.muted);
    this.doc.text(label.toUpperCase(), MARGIN, this.y);
    this.y += 5;
  }

  // Flowing body text, auto page-breaks per line
  body(text: string, size = 9.5): void {
    if (!text?.trim()) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...C.text);

    const lines = this.doc.splitTextToSize(text, CONTENT_W) as string[];
    for (const line of lines) {
      this.checkPage(BODY_LH + 1);
      this.doc.text(line, MARGIN, this.y);
      this.y += BODY_LH;
    }
  }

  // Bullet list — uses hyphen prefix (ASCII, safe in all built-in fonts)
  bulletList(items: string[]): void {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C.text);

    for (const item of items) {
      const lines = this.doc.splitTextToSize(item, CONTENT_W - 8) as string[];
      this.checkPage(lines.length * SMALL_LH + 2);

      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...C.brand);
      this.doc.text('-', MARGIN + 2, this.y);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...C.text);
      this.doc.text(lines, MARGIN + 7, this.y);
      this.y += lines.length * SMALL_LH + 2;
    }
  }

  spacer(mm: number): void {
    this.y += mm;
  }
}
