import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription } from 'rxjs';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { ThemeService } from '../../services/theme.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';
import { AnalysisSession } from '../../models/analysis-session.model';
import { AiRisk } from '../../models/ai-analysis-result.model';
import { ModernizationRecommendation } from '../../models/modernization-recommendation.model';
import { ModernizationItem } from '../../models/modernization-item.model';
import { CodeRecommendation, RecommendationCategory } from '../../models/code-recommendation.model';

type CategoryKey = RecommendationCategory;

@Component({
  selector: 'app-file-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MonacoEditorModule, ResizeDividerComponent],
  templateUrl: './file-code-recommendations-page.html',
  styleUrl: './file-code-recommendations-page.scss',
})
export class FileCodeRecommendationsPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  hasSession = false;

  recommendations: CodeRecommendation[] = [];
  selected: CodeRecommendation | null = null;

  collapsed: Record<CategoryKey, boolean> = {
    issues: true,
    modernization: true,
    security: true,
  };

  editorCode = '';
  editorOptions: Record<string, unknown> = {};
  private editorInstance: unknown = null;
  private decorationIds: string[] = [];
  private themeSub: Subscription | null = null;
  private sessionSub: Subscription | null = null;

  // Copy state — each key tracks whether that button is in "Copied!" state
  copyState: Record<string, boolean> = {};

  panelWidths = [300];

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly themeService: ThemeService,
    private readonly layoutService: PanelLayoutService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('file-rcr') ?? [300];
    this.editorOptions = this.buildEditorOptions();
    this.sessionSub = this.currentAnalysis.session$.subscribe(s => {
      this.session = s;
      this.hasSession = s !== null;
      if (s) this.buildRecommendations(s);
      else this.recommendations = [];
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.sessionSub?.unsubscribe();
    (this.editorInstance as any)?.dispose();
  }

  // ── Recommendation building ────────────────────────────────────────────────

  private buildRecommendations(session: AnalysisSession): void {
    const recs: CodeRecommendation[] = [];
    const fileName = session.fileName;

    if ((session.aiAnalysis?.risks?.length ?? 0) > 0) {
      (session.aiAnalysis!.risks as AiRisk[]).forEach((r, i) => recs.push({
        id: `risk-${i}`,
        title: r.title,
        fileName,
        category: 'issues',
        severity: r.severity.toLowerCase() as CodeRecommendation['severity'],
        description: r.description,
        solution: '',
        searchTerm: r.title.split(' ')[0],
      }));
    } else {
      (session.analysis.risks ?? []).forEach((r, i) => recs.push({
        id: `risk-${i}`,
        title: r.description,
        fileName,
        category: 'issues',
        severity: r.severity as CodeRecommendation['severity'],
        description: r.description,
        solution: '',
      }));
    }

    if ((session.aiAnalysis?.modernizations?.length ?? 0) > 0) {
      (session.aiAnalysis!.modernizations as ModernizationRecommendation[]).forEach((m, i) => recs.push({
        id: `modern-${i}`,
        title: m.title,
        fileName,
        category: 'modernization',
        severity: 'info',
        description: m.description,
        solution: '',
        searchTerm: m.title.split(' ')[0],
      }));
    } else {
      (session.analysis.modernizationSuggestions ?? []).forEach((m: ModernizationItem, i) => recs.push({
        id: `modern-${i}`,
        title: m.description,
        fileName,
        category: 'modernization',
        severity: 'info',
        description: m.description,
        solution: '',
      }));
    }

    this.recommendations = recs;
  }

  // ── Category grouping ──────────────────────────────────────────────────────

  get issueRecs():         CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'issues'); }
  get modernizationRecs(): CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'modernization'); }
  get securityRecs():      CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'security'); }

  get fileName(): string { return this.session?.fileName ?? 'File'; }

  get isAiPowered(): boolean {
    return (this.session?.aiAnalysis?.risks?.length ?? 0) > 0 ||
           (this.session?.aiAnalysis?.modernizations?.length ?? 0) > 0;
  }

  // ── Category collapse ──────────────────────────────────────────────────────

  toggleCategory(cat: CategoryKey): void {
    this.collapsed[cat] = !this.collapsed[cat];
  }

  onPanelResize(index: number, width: number): void {
    this.panelWidths = this.panelWidths.map((w, i) => i === index ? width : w);
    this.layoutService.save('file-rcr', this.panelWidths);
  }

  // ── Recommendation selection ───────────────────────────────────────────────

  selectRecommendation(rec: CodeRecommendation): void {
    this.selected = rec;
    this.loadFileForRecommendation(rec);
  }

  // ── Copy utilities ─────────────────────────────────────────────────────────

  copyToClipboard(key: string, text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copyState[key] = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copyState[key] = false;
        this.cdr.detectChanges();
      }, 1500);
    });
  }

  copyCode(): void {
    this.copyToClipboard('code', this.editorCode);
  }

  copyRecommendation(): void {
    if (!this.selected) return;
    const text = `${this.selected.title}\n\n${this.selected.description}`;
    this.copyToClipboard('rec', text);
  }

  copySuggestedFix(): void {
    if (!this.selected) return;
    const fix = this.selected.suggestedImprovement ?? this.selected.solution ?? '';
    this.copyToClipboard('fix', fix);
  }

  copyFull(): void {
    if (!this.selected) return;
    const parts = [
      `Title: ${this.selected.title}`,
      `File: ${this.selected.fileName}`,
      `Severity: ${this.selected.severity}`,
      `\nDescription:\n${this.selected.explanation ?? this.selected.description}`,
    ];
    if (this.selected.suggestedImprovement ?? this.selected.solution) {
      parts.push(`\nSuggested Fix:\n${this.selected.suggestedImprovement ?? this.selected.solution}`);
    }
    if (this.selected.codeSnippet ?? this.editorCode) {
      parts.push(`\nCode Snippet:\n${this.selected.codeSnippet ?? this.editorCode}`);
    }
    if (this.selected.expectedImpact) {
      parts.push(`\nExpected Impact:\n${this.selected.expectedImpact}`);
    }
    this.copyToClipboard('full', parts.join('\n'));
  }

  // ── Monaco ─────────────────────────────────────────────────────────────────

  private loadFileForRecommendation(rec: CodeRecommendation): void {
    const content = rec.codeSnippet ?? this.session?.sourceCode ?? `// Source code not available.`;
    const ext = (rec.fileName.split('.').pop() ?? 'txt').toLowerCase();
    const language = this.languageFromExt(ext);

    this.editorOptions = { ...this.buildEditorOptions(), language };
    this.editorCode = content;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.zone.run(() => {
        this.applyHighlight(rec);
        this.cdr.detectChanges();
      });
    }, 80);
  }

  private applyHighlight(rec: CodeRecommendation): void {
    const editor = this.editorInstance as any;
    if (!editor || !rec.searchTerm) return;
    const model = editor.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;

    this.decorationIds = editor.deltaDecorations(this.decorationIds, []);

    const term = rec.searchTerm;
    const matches = model.findMatches(term, true, false, false, null, true);
    if (!matches || matches.length === 0) return;

    const first = matches[0].range;
    this.decorationIds = editor.deltaDecorations([], [{
      range: first,
      options: {
        className: 'rec-highlight',
        isWholeLine: false,
        overviewRuler: { color: '#F97316', position: 1 },
        minimap: { color: '#F97316', position: 1 },
      },
    }]);

    editor.revealLineInCenter(first.startLineNumber);
  }

  onEditorInit(editor: unknown): void {
    this.zone.run(() => {
      this.editorInstance = editor;

      this.themeSub = this.themeService.isDark$.subscribe(isDark => {
        const m = (window as any).monaco;
        if (m) m.editor.setTheme(isDark ? 'vs-dark' : 'vs');
      });

      if (this.selected) {
        setTimeout(() => this.applyHighlight(this.selected!), 80);
      }
    });
  }

  private buildEditorOptions(): Record<string, unknown> {
    return {
      theme: this.themeService.isDark ? 'vs-dark' : 'vs',
      language: 'plaintext',
      readOnly: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
      renderLineHighlight: 'all',
      roundedSelection: true,
      smoothScrolling: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      glyphMargin: false,
      automaticLayout: true,
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
      padding: { top: 14, bottom: 14 },
      fixedOverflowWidgets: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
    };
  }

  private languageFromExt(ext: string): string {
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      cs: 'csharp', html: 'html', css: 'css', scss: 'scss',
      json: 'json', xml: 'xml', sql: 'sql', py: 'python',
      md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'shell',
    };
    return map[ext] ?? 'plaintext';
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  severityClass(s: string): string {
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' } as Record<string, string>)[s] ?? 'sev-info';
  }
}
