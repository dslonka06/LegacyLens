import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge, SourceFile } from '../../models/knowledge.model';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CodeRecommendation } from '../../models/code-recommendation.model';
import { RepositoryInsight, RepositoryInsightsService } from '../../services/repository-insights.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { PanelLayoutService } from '../../services/panel-layout.service';
import { ResizeDividerComponent } from '../../components/resize-divider/resize-divider.component';
import { ThemeService } from '../../services/theme.service';
import { WorkspaceChangesService } from '../../services/workspace-changes.service';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { UnsavedChangesService } from '../../services/unsaved-changes.service';

type CategoryKey = 'issues' | 'modernization' | 'security';

@Component({
  selector: 'app-repository-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MonacoEditorModule, FormsModule, ResizeDividerComponent],
  templateUrl: './repository-code-recommendations-page.html',
  styleUrl: './repository-code-recommendations-page.scss',
})
export class RepositoryCodeRecommendationsPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
  session: AnalysisSession | null = null;
  hasWorkspace = false;

  recommendations: CodeRecommendation[] = [];
  selected: CodeRecommendation | null = null;

  collapsed: Record<CategoryKey, boolean> = {
    issues: true,
    modernization: true,
    security: true,
  };

  // Editor state
  editorCode = '';
  editorOptions: Record<string, any> = {};
  private editorInstance: any = null;
  private decorationIds: string[] = [];
  private themeSub: Subscription | null = null;

  private subs: Subscription[] = [];

  // Save state
  private originalContent = '';
  private currentFilePath = '';
  saveStatus: 'idle' | 'saved' | 'modified' = 'idle';

  panelWidths = [300];

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly themeService: ThemeService,
    private readonly changesService: WorkspaceChangesService,
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
    private readonly unsaved: UnsavedChangesService,
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
    this.unsaved.clear();
    this.subs.forEach(s => s.unsubscribe());
    this.themeSub?.unsubscribe();
    this.editorInstance?.dispose();
  }

  // ── Recommendation building ────────────────────────────────────────────────

  private buildRecommendations(knowledge: RepositoryKnowledge): void {
    const recs: CodeRecommendation[] = [];
    const insights = this.insightsService.analyze(knowledge);
    const sourceFiles = knowledge.sourceFiles ?? [];

    // Map RepositoryInsights → recommendations, skipping pure stat entries
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
        severity: (insight.severity === 'info' ? 'low' : insight.severity) as any,
        description: insight.description,
        solution,
        searchTerm: insight.affectedFiles?.[0],
      });
    }

    // Additional modernization recommendations from dependency graph
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

    // Merge AI-generated risks and modernizations when available
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
        return 'Review the affected file and apply the recommendation described above. Use the editor below to make changes.';
    }
  }

  private firstFileName(sourceFiles: SourceFile[]): string {
    return sourceFiles[0]?.path.split('/').pop() ?? sourceFiles[0]?.path ?? 'No file';
  }

  // ── Category grouping ──────────────────────────────────────────────────────

  get issueRecs():       CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'issues'); }
  get modernizationRecs(): CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'modernization'); }
  get securityRecs():    CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'security'); }

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

  saveChanges(): void {
    if (!this.selected || this.editorCode === this.originalContent) return;
    this.changesService.saveChange(
      this.manager.activeId ?? '',
      this.currentFilePath,
      this.originalContent,
      this.editorCode,
      { id: this.selected.id, title: this.selected.title, category: this.selected.category, severity: this.selected.severity },
    );
    this.saveStatus = 'saved';
    this.unsaved.clear();
    this.cdr.detectChanges();
  }

  onEditorChange(): void {
    const dirty = this.editorCode !== this.originalContent && this.originalContent !== '';
    this.unsaved.set(dirty);
  }

  get isModified(): boolean {
    return this.editorCode !== this.originalContent && this.originalContent !== '';
  }

  private loadFileForRecommendation(rec: CodeRecommendation): void {
    const sourceFiles = this.knowledge?.sourceFiles ?? [];
    const match = this.findSourceFile(rec.fileName, sourceFiles);
    const content = match?.content ?? `// File "${rec.fileName}" is not available in the current workspace.\n// Upload the workspace from the analysis page to enable editing.`;
    const ext = (match?.extension ?? rec.fileName.split('.').pop() ?? 'txt').toLowerCase();
    const language = this.languageFromExt(ext);

    this.originalContent = content;
    this.currentFilePath = match?.path ?? rec.fileName;
    this.saveStatus = this.changesService.isModified(this.manager.activeId ?? '', this.currentFilePath) ? 'saved' : 'idle';

    this.editorOptions = { ...this.buildEditorOptions(), language };
    this.editorCode = content;
    this.cdr.detectChanges();

    // Highlight after a tick to let Monaco re-render with new content
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
    if (!this.editorInstance || !rec.searchTerm) return;
    const model = this.editorInstance.getModel();
    if (!model) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    // Clear previous decorations
    this.decorationIds = this.editorInstance.deltaDecorations(this.decorationIds, []);

    const term = rec.searchTerm.split('/').pop() ?? rec.searchTerm;
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

      // Re-apply highlight if a recommendation was selected before the editor initialized
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
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' } as any)[s] ?? 'sev-low';
  }

  categoryIcon(cat: CategoryKey): string {
    return ({ issues: '⚠', modernization: '⚡', security: '🔒' } as any)[cat] ?? '•';
  }
}
