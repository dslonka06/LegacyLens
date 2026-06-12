import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge, SourceFile } from '../../models/knowledge.model';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CodeRecommendation, RecommendationSeverity } from '../../models/code-recommendation.model';
import { RepositoryInsight, RepositoryInsightsService } from '../../services/repository-insights.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';
import { ThemeService } from '../../services/theme.service';

type CategoryKey = 'issues' | 'modernization' | 'security';

@Component({
  selector: 'app-repository-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MonacoEditorModule, ResizeDividerComponent],
  templateUrl: './repository-code-recommendations-page.html',
  styleUrl: './repository-code-recommendations-page.scss',
})
export class RepositoryCodeRecommendationsPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  session: AnalysisSession | null = null;
  hasWorkspace = false;

  recommendations: CodeRecommendation[] = [];
  selected: CodeRecommendation | null = null;
  activeSeverityFilter: RecommendationSeverity | null = null;

  readonly SEVERITY_ORDER: RecommendationSeverity[] = ['high', 'medium', 'low', 'info'];

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

  private subs: Subscription[] = [];

  // Copy state — each key tracks whether that button is in "Copied!" state
  copyState: Record<string, boolean> = {};

  panelWidths = [300];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly themeService: ThemeService,
    private readonly layoutService: PanelLayoutService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.panelWidths = this.layoutService.load('repository-rcr') ?? [300];
    this.editorOptions = this.buildEditorOptions();

    this.knowledge = this.knowledgeService.knowledge;
    this.hasWorkspace = this.workspace.context !== null;
    if (this.knowledge) this.buildRecommendations(this.knowledge);

    this.subs.push(
      this.knowledgeService.knowledge$.subscribe(k => {
        this.knowledge = k;
        if (k) this.buildRecommendations(k);
        else this.recommendations = [];
        this.cdr.detectChanges();
      }),
      this.workspace.context$.subscribe(ctx => {
        this.hasWorkspace = ctx !== null;
        this.cdr.detectChanges();
      }),
      this.currentAnalysis.session$.subscribe(s => {
        this.session = s;
        if (this.knowledge) this.buildRecommendations(this.knowledge);
        this.cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.themeSub?.unsubscribe();
    (this.editorInstance as any)?.dispose();
  }

  // ── Recommendation building ────────────────────────────────────────────────

  private buildRecommendations(knowledge: RepositoryKnowledge): void {
    const recs: CodeRecommendation[] = [];
    const insights = this.insightsService.analyze(knowledge);
    const sourceFiles = knowledge.sourceFiles ?? [];

    for (const insight of insights) {
      if (insight.category === 'stat') continue;

      const fileName = insight.affectedFiles?.[0] ?? this.firstFileName(sourceFiles);
      const category = this.mapCategory(insight);
      const solution = this.solutionFor(insight);

      recs.push({
        id: `insight-${recs.length}`,
        title: insight.title,
        fileName,
        category,
        severity: insight.severity as CodeRecommendation['severity'],
        description: insight.description,
        solution,
        searchTerm: insight.affectedFiles?.[0],
      });
    }

    const graph = knowledge.dependencyGraph;
    if (graph) {
      const isolated = graph.nodes.filter(n => {
        const connected = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
        return !connected.has(n.id);
      });
      if (isolated.length > 3) {
        recs.push({
          id: 'orphan-modernization',
          title: `${isolated.length} files with no dependencies detected`,
          fileName: isolated[0]?.name ?? this.firstFileName(sourceFiles),
          category: 'modernization',
          severity: 'low',
          description: `${isolated.length} files appear disconnected from the rest of the codebase. They may be unused utilities, dead code, or intentional standalone modules.`,
          solution: 'Review each isolated file. Remove dead code. Document intentionally standalone utilities. Consider whether they belong in a shared utilities module.',
          searchTerm: isolated[0]?.name,
        });
      }
    }

    const ai = this.session?.aiAnalysis;
    const primaryFile = this.firstFileName(sourceFiles);
    if (ai?.risks?.length) {
      ai.risks.forEach((r, i) => {
        if (!recs.some(rec => rec.title === r.title)) {
          recs.push({
            id: `ai-risk-${i}`,
            title: r.title,
            fileName: primaryFile,
            category: 'issues',
            severity: (r.severity?.toLowerCase() ?? 'medium') as CodeRecommendation['severity'],
            description: r.description,
            solution: 'Review the affected code and address the identified risk. Apply the principle of least privilege and isolate the concern to reduce impact.',
            searchTerm: r.title.split(' ')[0],
          });
        }
      });
    }
    if (ai?.modernizations?.length) {
      ai.modernizations.forEach((m, i) => {
        if (!recs.some(rec => rec.title === m.title)) {
          recs.push({
            id: `ai-modern-${i}`,
            title: m.title,
            fileName: primaryFile,
            category: 'modernization',
            severity: 'low',
            description: m.description,
            solution: 'Modernize the implementation using current framework and language patterns. Apply the suggested changes incrementally to reduce risk.',
            searchTerm: m.title.split(' ')[0],
          });
        }
      });
    }

    this.recommendations = recs;
  }

  private mapCategory(insight: RepositoryInsight): 'issues' | 'modernization' | 'security' {
    switch (insight.category) {
      case 'high-coupling': return 'issues';
      case 'hub':           return 'issues';
      case 'broad-scope':   return 'modernization';
      case 'orphan':        return 'modernization';
      default:              return 'issues';
    }
  }

  private solutionFor(insight: RepositoryInsight): string {
    switch (insight.category) {
      case 'high-coupling':
        return 'Consider whether this file has too many responsibilities. Extract cohesive groups of functionality into separate modules. Introduce an abstraction (interface or service) to decouple consumers from this implementation.';
      case 'broad-scope':
        return 'Review the imports and dependencies of this file. If it crosses multiple concern boundaries (UI + data + business logic), decompose it into focused, single-responsibility modules.';
      case 'hub':
        return 'Dependency hubs are change-risk hotspots. Consider introducing an abstraction layer (facade, mediator, or interface) between this module and its many dependents to reduce blast radius.';
      case 'orphan':
        return 'Verify each orphaned file is intentionally standalone. Remove confirmed dead code. Move shared utilities into a dedicated utilities module with clear ownership.';
      default:
        return 'Review the affected file and apply the recommendation described above.';
    }
  }

  private firstFileName(sourceFiles: SourceFile[]): string {
    return sourceFiles[0]?.path.split('/').pop() ?? sourceFiles[0]?.path ?? 'No file';
  }

  // ── Category grouping ──────────────────────────────────────────────────────

  private filteredAndSorted(category: CategoryKey): CodeRecommendation[] {
    return this.recommendations
      .filter(r => r.category === category && (!this.activeSeverityFilter || r.severity === this.activeSeverityFilter))
      .sort((a, b) => this.SEVERITY_ORDER.indexOf(a.severity) - this.SEVERITY_ORDER.indexOf(b.severity));
  }

  get issueRecs():         CodeRecommendation[] { return this.filteredAndSorted('issues'); }
  get modernizationRecs(): CodeRecommendation[] { return this.filteredAndSorted('modernization'); }
  get securityRecs():      CodeRecommendation[] { return this.filteredAndSorted('security'); }

  setSeverityFilter(sev: RecommendationSeverity | null): void {
    this.activeSeverityFilter = this.activeSeverityFilter === sev ? null : sev;
  }

  get workspaceName(): string { return this.workspace.context?.workspaceName ?? 'Repository'; }

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
    this.layoutService.save('repository-rcr', this.panelWidths);
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
    const text = `${this.selected.title}\n\n${this.selected.explanation ?? this.selected.description}`;
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
    const sourceFiles = this.knowledge?.sourceFiles ?? [];
    const match = this.findSourceFile(rec.fileName, sourceFiles);
    const content = rec.codeSnippet
      ?? match?.content
      ?? `// File "${rec.fileName}" is not available in the current workspace.\n// Upload the workspace from the analysis page to view the source code.`;
    const ext = (match?.extension ?? rec.fileName.split('.').pop() ?? 'txt').toLowerCase();
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

  private findSourceFile(fileName: string, sources: SourceFile[]): SourceFile | undefined {
    const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase();
    const target = norm(fileName);
    return (
      sources.find(f => norm(f.path) === target) ??
      sources.find(f => norm(f.path).endsWith('/' + target)) ??
      sources.find(f => norm(f.path.split('/').pop() ?? '') === target)
    );
  }

  private applyHighlight(rec: CodeRecommendation): void {
    const editor = this.editorInstance as any;
    const monaco = (window as any).monaco;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    this.decorationIds = editor.deltaDecorations(this.decorationIds, []);

    let range: unknown;

    if (rec.lineStart != null) {
      const lineEnd = rec.lineEnd ?? rec.lineStart;
      range = new monaco.Range(rec.lineStart, 1, lineEnd, model.getLineMaxColumn(lineEnd));
    } else if (rec.searchTerm) {
      const term = rec.searchTerm.split('/').pop() ?? rec.searchTerm;
      const matches = model.findMatches(term, true, false, false, null, true);
      if (!matches || matches.length === 0) return;
      range = matches[0].range;
    } else {
      return;
    }

    this.decorationIds = editor.deltaDecorations([], [{
      range,
      options: {
        className: 'rec-highlight',
        isWholeLine: rec.lineStart != null,
        overviewRuler: { color: '#F97316', position: 1 },
        minimap: { color: '#F97316', position: 1 },
      },
    }]);

    editor.revealLineInCenter((range as any).startLineNumber);
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
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' } as Record<string, string>)[s] ?? 'sev-low';
  }

  categoryIcon(cat: CategoryKey): string {
    return ({ issues: '⚠', modernization: '⚡', security: '🔒' } as Record<string, string>)[cat] ?? '•';
  }
}
