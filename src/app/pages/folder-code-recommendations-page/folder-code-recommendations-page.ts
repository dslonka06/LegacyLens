import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RepositoryKnowledge, SourceFile } from '../../models/knowledge.model';
import { CodeRecommendation } from '../../models/code-recommendation.model';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { ThemeService } from '../../services/theme.service';

type CategoryKey = 'issues' | 'modernization' | 'security';

@Component({
  selector: 'app-folder-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MonacoEditorModule, FormsModule],
  templateUrl: './folder-code-recommendations-page.html',
  styleUrl: './folder-code-recommendations-page.scss',
})
export class FolderCodeRecommendationsPage implements OnInit, OnDestroy {

  knowledge: RepositoryKnowledge | null = null;
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

  constructor(
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly themeService: ThemeService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
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
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.themeSub?.unsubscribe();
    this.editorInstance?.dispose();
  }

  // ── Recommendation building ────────────────────────────────────────────────

  private buildRecommendations(knowledge: RepositoryKnowledge): void {
    const recs: CodeRecommendation[] = [];
    const graph = knowledge.dependencyGraph;
    const architecture = knowledge.architecture;
    const sourceFiles = knowledge.sourceFiles ?? [];

    if (graph) {
      // Highly-coupled nodes (high inbound)
      const inbound = new Map<string, number>();
      graph.edges.forEach(e => inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1));
      const hubs = graph.nodes.filter(n => (inbound.get(n.id) ?? 0) >= 5);

      if (hubs.length > 0) {
        for (const hub of hubs.slice(0, 3)) {
          recs.push({
            id: `coupling-${hub.id}`,
            title: `High Coupling: ${hub.name}`,
            fileName: hub.name,
            category: 'issues',
            severity: (inbound.get(hub.id) ?? 0) >= 10 ? 'high' : 'medium',
            description: `${hub.name} has ${inbound.get(hub.id)} direct dependents. Changes to this file have a wide blast radius and increase the risk of regressions across the codebase.`,
            solution: 'Extract cohesive responsibilities into smaller, focused modules. Introduce an interface or abstraction layer between this module and its consumers. Consumers should depend on the abstraction, not the concrete implementation.',
            searchTerm: hub.name,
          });
        }
      }

      // Circular dependencies
      const sources = new Set(graph.edges.map(e => e.source));
      const targets = new Set(graph.edges.map(e => e.target));
      const mutual = [...sources].filter(s =>
        targets.has(s) &&
        graph.edges.some(e => e.source === s && sources.has(e.target) && graph.edges.some(e2 => e2.source === e.target && e2.target === s))
      );
      if (mutual.length > 0) {
        const node = graph.nodes.find(n => n.id === mutual[0]);
        recs.push({
          id: 'circular-deps',
          title: 'Circular Dependencies Detected',
          fileName: node?.name ?? this.firstFileName(sourceFiles),
          category: 'issues',
          severity: 'high',
          description: 'Modules with mutual references create circular dependencies. This can cause initialization order failures, make testing harder, and prevent tree-shaking in bundlers.',
          solution: 'Break cycles by introducing a shared abstraction that both modules can depend on. Apply Dependency Inversion — depend on interfaces, not concrete implementations. Consider restructuring shared data into a dedicated model module.',
          searchTerm: node?.name,
        });
      }

      // No architecture pattern on large codebase
      if (graph.nodes.length > 20 && (!architecture?.patterns.length)) {
        recs.push({
          id: 'no-pattern',
          title: 'No Clear Architecture Pattern',
          fileName: this.firstFileName(sourceFiles),
          category: 'modernization',
          severity: 'medium',
          description: `This folder contains ${graph.nodes.length} files with no dominant architecture pattern. As codebases grow without structure, maintenance complexity increases significantly.`,
          solution: 'Choose an architecture pattern appropriate for this codebase (layered, feature-based, or domain-driven). Organize files consistently. Rename folders to reflect their responsibility (services/, models/, components/).',
        });
      }

      // Isolated/orphaned files
      const connected = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
      const isolated = graph.nodes.filter(n => !connected.has(n.id));
      if (isolated.length > 3) {
        recs.push({
          id: 'isolated-files',
          title: `${isolated.length} Isolated Files Detected`,
          fileName: isolated[0]?.name ?? this.firstFileName(sourceFiles),
          category: 'modernization',
          severity: 'low',
          description: `${isolated.length} files have no detected import or export relationships. They may be dead code, standalone utilities, or unreferenced entry points.`,
          solution: 'Review each isolated file. Delete confirmed dead code. Move standalone utilities into a shared utilities module. Document intentionally standalone files.',
          searchTerm: isolated[0]?.name,
        });
      }

      // Broad scope — high outbound dependency count
      const outbound = new Map<string, number>();
      graph.edges.forEach(e => outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1));
      const broadScope = graph.nodes.filter(n => (outbound.get(n.id) ?? 0) >= 10).slice(0, 2);
      for (const node of broadScope) {
        recs.push({
          id: `broad-${node.id}`,
          title: `Broad Scope: ${node.name}`,
          fileName: node.name,
          category: 'modernization',
          severity: 'medium',
          description: `${node.name} depends on ${outbound.get(node.id)} other files. A module with this many outbound dependencies likely spans multiple concerns and is difficult to test in isolation.`,
          solution: 'Decompose this module by concern. If it handles both data fetching and transformation, split these into separate modules. Each module should have a clear, single reason to change.',
          searchTerm: node.name,
        });
      }
    }

    // Architecture confidence issues
    if (architecture?.patterns.length) {
      const lowConfidence = architecture.patterns.filter(p => p.confidence < 0.5);
      if (lowConfidence.length > 0) {
        recs.push({
          id: 'mixed-patterns',
          title: 'Mixed Architecture Patterns',
          fileName: this.firstFileName(sourceFiles),
          category: 'modernization',
          severity: 'medium',
          description: `Patterns detected with low confidence: ${lowConfidence.map(p => p.name).join(', ')}. Inconsistent patterns increase cognitive overhead for developers unfamiliar with the codebase.`,
          solution: 'Choose a primary architecture pattern and migrate inconsistent areas toward it incrementally. Document the chosen pattern in a README or architecture decision record.',
        });
      }
    }

    this.recommendations = recs;
  }

  private firstFileName(sourceFiles: SourceFile[]): string {
    return sourceFiles[0]?.path.split('/').pop() ?? sourceFiles[0]?.path ?? 'No file';
  }

  // ── Category grouping ──────────────────────────────────────────────────────

  get issueRecs():         CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'issues'); }
  get modernizationRecs(): CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'modernization'); }
  get securityRecs():      CodeRecommendation[] { return this.recommendations.filter(r => r.category === 'security'); }

  get workspaceName(): string { return this.workspace.context?.workspaceName ?? 'Folder'; }

  // ── Category collapse ──────────────────────────────────────────────────────

  toggleCategory(cat: CategoryKey): void {
    this.collapsed[cat] = !this.collapsed[cat];
  }

  // ── Recommendation selection ───────────────────────────────────────────────

  selectRecommendation(rec: CodeRecommendation): void {
    this.selected = rec;
    this.loadFileForRecommendation(rec);
  }

  private loadFileForRecommendation(rec: CodeRecommendation): void {
    const sourceFiles = this.knowledge?.sourceFiles ?? [];
    const match = this.findSourceFile(rec.fileName, sourceFiles);
    const content = match?.content ?? `// File "${rec.fileName}" is not available in the current workspace.\n// Upload the workspace from the analysis page to enable editing.`;
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
    if (!this.editorInstance || !rec.searchTerm) return;
    const model = this.editorInstance.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;

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
    return ({ high: 'sev-high', medium: 'sev-medium', low: 'sev-low' } as any)[s] ?? 'sev-low';
  }
}
