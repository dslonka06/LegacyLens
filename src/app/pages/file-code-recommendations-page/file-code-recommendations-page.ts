import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription } from 'rxjs';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { ThemeService } from '../../services/theme.service';
import { WorkspaceChangesService } from '../../services/workspace-changes.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';
import { AnalysisSession } from '../../models/analysis-session.model';
import { AiRisk } from '../../models/ai-analysis-result.model';
import { ModernizationRecommendation } from '../../models/modernization-recommendation.model';
import { ModernizationItem } from '../../models/modernization-item.model';

type CategoryKey = 'issues' | 'modernization' | 'security';

interface FileRec {
  id: string;
  title: string;
  fileName: string;
  category: CategoryKey;
  severity: 'high' | 'medium' | 'low' | 'info';
  description: string;
  solution?: string;
  searchTerm?: string;
}

@Component({
  selector: 'app-file-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MonacoEditorModule, FormsModule, ResizeDividerComponent],
  templateUrl: './file-code-recommendations-page.html',
  styleUrl: './file-code-recommendations-page.scss',
})
export class FileCodeRecommendationsPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  hasSession = false;

  recommendations: FileRec[] = [];
  selected: FileRec | null = null;

  collapsed: Record<CategoryKey, boolean> = {
    issues: true,
    modernization: true,
    security: true,
  };

  editorCode = '';
  editorOptions: Record<string, any> = {};
  private editorInstance: any = null;
  private decorationIds: string[] = [];
  private themeSub: Subscription | null = null;
  private sessionSub: Subscription | null = null;

  // Save state
  private originalContent = '';
  private currentFilePath = '';
  saveStatus: 'idle' | 'saved' | 'modified' = 'idle';

  panelWidths = [300];

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly themeService: ThemeService,
    private readonly changes: WorkspaceChangesService,
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
    this.editorInstance?.dispose();
  }

  // ── Recommendation building ────────────────────────────────────────────────

  private buildRecommendations(session: AnalysisSession): void {
    const recs: FileRec[] = [];
    const fileName = session.fileName;

    if ((session.aiAnalysis?.risks?.length ?? 0) > 0) {
      (session.aiAnalysis!.risks as AiRisk[]).forEach((r, i) => recs.push({
        id: `risk-${i}`,
        title: r.title,
        fileName,
        category: 'issues',
        severity: r.severity.toLowerCase() as FileRec['severity'],
        description: r.description,
        searchTerm: r.title.split(' ')[0],
      }));
    } else {
      (session.analysis.risks ?? []).forEach((r, i) => recs.push({
        id: `risk-${i}`,
        title: r.description,
        fileName,
        category: 'issues',
        severity: r.severity as FileRec['severity'],
        description: r.description,
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
      }));
    }

    this.recommendations = recs;
  }

  // ── Category grouping ──────────────────────────────────────────────────────

  get issueRecs():         FileRec[] { return this.recommendations.filter(r => r.category === 'issues'); }
  get modernizationRecs(): FileRec[] { return this.recommendations.filter(r => r.category === 'modernization'); }
  get securityRecs():      FileRec[] { return this.recommendations.filter(r => r.category === 'security'); }

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

  selectRecommendation(rec: FileRec): void {
    this.selected = rec;
    this.loadFileForRecommendation(rec);
  }

  saveChanges(): void {
    if (!this.selected || this.editorCode === this.originalContent) return;
    this.changes.saveChange(
      'file',
      this.currentFilePath,
      this.originalContent,
      this.editorCode,
      {
        recommendationId: this.selected.id,
        recommendationTitle: this.selected.title,
        category: this.selected.category,
        severity: this.selected.severity,
      },
    );
    this.saveStatus = 'saved';
    this.cdr.detectChanges();
  }

  get isModified(): boolean {
    return this.editorCode !== this.originalContent && this.originalContent !== '';
  }

  get isFileSaved(): boolean {
    return this.saveStatus === 'saved' && !this.isModified;
  }

  private loadFileForRecommendation(rec: FileRec): void {
    const content = this.session?.sourceCode ?? `// Source code not available.`;
    const ext = (rec.fileName.split('.').pop() ?? 'txt').toLowerCase();
    const language = this.languageFromExt(ext);

    this.originalContent = content;
    this.currentFilePath = this.session?.fileName ?? rec.fileName;
    this.saveStatus = this.changes.isModified('file', this.currentFilePath) ? 'saved' : 'idle';

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

  private applyHighlight(rec: FileRec): void {
    if (!this.editorInstance || !rec.searchTerm) return;
    const model = this.editorInstance.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;

    this.decorationIds = this.editorInstance.deltaDecorations(this.decorationIds, []);

    const term = rec.searchTerm;
    const matches = model.findMatches(term, true, false, false, null, true);
    if (!matches || matches.length === 0) return;

    const first = matches[0].range;
    this.decorationIds = this.editorInstance.deltaDecorations([], [{
      range: first,
      options: {
        className: 'rec-highlight',
        isWholeLine: false,
        overviewRuler: { color: '#F97316', position: 1 },
        minimap: { color: '#F97316', position: 1 },
      },
    }]);

    this.editorInstance.revealLineInCenter(first.startLineNumber);
  }

  // ── Monaco ─────────────────────────────────────────────────────────────────

  onEditorInit(editor: any): void {
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

  private buildEditorOptions(): Record<string, any> {
    return {
      theme: this.themeService.isDark ? 'vs-dark' : 'vs',
      language: 'plaintext',
      readOnly: false,
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
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' } as any)[s] ?? 'sev-info';
  }
}
