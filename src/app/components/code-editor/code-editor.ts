import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription, firstValueFrom } from 'rxjs';
import { AnalysisService } from '../../services/analysis.service';
import { AiAnalysisService } from '../../services/ai-analysis.service';
import { FileInventoryService } from '../../services/file-inventory.service';
import { WorkspaceClassifierService } from '../../services/workspace-classifier.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { WorkspaceProfile } from '../../models/workspace.model';
import { RepositoryKnowledge } from '../../models/knowledge.model';
import { ThemeService } from '../../services/theme.service';

// Extension → Monaco language ID
const EXT_LANGUAGE_MAP: Record<string, string> = {
  cs:     'csharp',
  ts:     'typescript',
  tsx:    'typescript',
  js:     'javascript',
  jsx:    'javascript',
  html:   'html',
  htm:    'html',
  css:    'css',
  scss:   'scss',
  less:   'less',
  sql:    'sql',
  py:     'python',
  json:   'json',
  xml:    'xml',
  csproj: 'xml',
  props:  'xml',
  config: 'xml',
  md:     'markdown',
  txt:    'plaintext',
  sh:     'shell',
  bash:   'shell',
  yml:    'yaml',
  yaml:   'yaml',
};

// Display label for the toolbar badge
const LANGUAGE_LABEL: Record<string, string> = {
  csharp:     'C#',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  html:       'HTML',
  css:        'CSS',
  scss:       'SCSS',
  less:       'Less',
  sql:        'SQL',
  python:     'Python',
  json:       'JSON',
  xml:        'XML',
  markdown:   'Markdown',
  plaintext:  'Plain Text',
  shell:      'Shell',
  yaml:       'YAML',
};

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss'
})
export class CodeEditor implements OnChanges, OnDestroy {

  @Input() restoredFileName: string | null = null;
  @Input() restoredSourceCode: string | null = null;

  @Output() readonly analyze = new EventEmitter<AnalysisSession>();
  @Output() readonly workspaceReady = new EventEmitter<WorkspaceProfile | null>();
  @Output() readonly knowledgeReady = new EventEmitter<RepositoryKnowledge>();

  code = '';
  fileName = 'untitled.txt';
  isAnalyzing = false;
  isLoadingFile = false;
  lastAnalyzedLabel: string | null = null;

  // Multi-file state: files beyond the primary display file
  uploadedFiles: File[] = [];
  workspaceProfile: WorkspaceProfile | null = null;

  private editorInstance: any = null;
  private currentMonacoLanguage = 'plaintext';
  private themeSub: Subscription | null = null;

  editorOptions = {
    theme: 'vs-dark',
    language: 'plaintext',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontLigatures: true,
    lineNumbers: 'on' as const,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off' as const,
    renderWhitespace: 'none' as const,
    renderLineHighlight: 'all' as const,
    roundedSelection: true,
    smoothScrolling: true,
    folding: true,
    bracketPairColorization: { enabled: true },
    lineDecorationsWidth: 4,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 14, bottom: 14 },
    fixedOverflowWidgets: true,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
  };

  aiError: string | null = null;

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly fileInventory: FileInventoryService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly knowledgeService: RepositoryKnowledgeService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly themeService: ThemeService
  ) {
    // Set initial Monaco theme to match app theme
    this.editorOptions = {
      ...this.editorOptions,
      theme: this.themeService.isDark ? 'vs-dark' : 'vs',
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['restoredFileName'] && this.restoredFileName) {
      this.fileName = this.restoredFileName;
    }
    if (changes['restoredSourceCode'] && this.restoredSourceCode !== null) {
      this.code = this.restoredSourceCode;
      this.lastAnalyzedLabel = 'Restored';
      if (this.editorInstance) {
        if (this.editorInstance.getValue() !== this.restoredSourceCode) {
          this.editorInstance.setValue(this.restoredSourceCode);
        }
        // Use filename for language if available, otherwise fall back to content
        const lang = this.restoredFileName
          ? this.languageFromFileName(this.restoredFileName)
          : this.languageFromContent(this.restoredSourceCode);
        this.applyMonacoLanguage(lang);
      }
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.editorInstance?.dispose();
  }

  get detectedLanguage(): string {
    return LANGUAGE_LABEL[this.currentMonacoLanguage] ?? 'Auto';
  }

  // CSS modifier class for the language badge colour
  get langBadgeClass(): string {
    const map: Record<string, string> = {
      csharp:     'lang-csharp',
      typescript: 'lang-typescript',
      javascript: 'lang-javascript',
      sql:        'lang-sql',
      python:     'lang-python',
      html:       'lang-html',
      css:        'lang-css',
      scss:       'lang-css',
      json:       'lang-json',
      xml:        'lang-xml',
      markdown:   'lang-markdown',
    };
    return map[this.currentMonacoLanguage] ?? 'lang-default';
  }

  // Which icon variant to show in the file tab
  get langIconType(): string {
    const map: Record<string, string> = {
      csharp:     'csharp',
      typescript: 'typescript',
      javascript: 'javascript',
      sql:        'database',
      python:     'python',
      html:       'html',
      json:       'json',
    };
    return map[this.currentMonacoLanguage] ?? 'file';
  }

  get lineCount(): number {
    return this.code ? this.code.split('\n').length : 1;
  }

  get isMultiFileWorkspace(): boolean {
    return this.uploadedFiles.length > 1;
  }

  get additionalFileCount(): number {
    return Math.max(0, this.uploadedFiles.length - 1);
  }

  onEditorInit(editor: any): void {
    this.zone.run(() => {
      this.editorInstance = editor;

      // Disable semantic validation — LegacyLens analyses standalone files,
      // not full projects, so import resolution errors are always false positives.
      const monaco = (window as any).monaco;
      if (monaco?.languages?.typescript) {
        const noValidation = {
          noSemanticValidation: true,
          noSyntaxValidation: false,  // keep syntax errors — they're meaningful
        };
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(noValidation);
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(noValidation);
      }

      if (this.code) {
        editor.setValue(this.code);
        const lang = this.fileName !== 'untitled.txt'
          ? this.languageFromFileName(this.fileName)
          : this.languageFromContent(this.code);
        this.applyMonacoLanguage(lang);
      }

      editor.onDidChangeModelContent(() => {
        this.zone.run(() => {
          this.code = editor.getValue();
          if (this.fileName === 'untitled.txt') {
            this.applyMonacoLanguage(this.languageFromContent(this.code));
          }
          this.cdr.detectChanges();
        });
      });

      // Sync Monaco theme with app theme in real time
      this.themeSub = this.themeService.isDark$.subscribe(isDark => {
        const m = (window as any).monaco;
        if (m) m.editor.setTheme(isDark ? 'vs-dark' : 'vs');
      });
    });
  }

  clearFile(): void {
    this.code = '';
    this.fileName = 'untitled.txt';
    this.lastAnalyzedLabel = null;
    this.currentMonacoLanguage = 'plaintext';
    this.uploadedFiles = [];
    this.workspaceProfile = null;
    this.knowledgeService.clear();
    this.currentWorkspace.clear();
    this.workspaceReady.emit(null);
    this.editorInstance?.setValue('');
    this.applyMonacoLanguage('plaintext');
    this.cdr.detectChanges();
  }

  // Single or multi-file selection
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    this.processFiles(files);

    // Reset so the same selection can be re-uploaded if needed
    input.value = '';
  }

  // Folder upload via webkitdirectory
  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files).filter(f => !this.isIgnoredPath(f));
    this.processFiles(files);

    input.value = '';
  }

  private processFiles(files: File[]): void {
    if (files.length === 0) return;

    this.isLoadingFile = true;
    this.uploadedFiles = files;

    // Stage 1+2: build workspace profile synchronously from metadata.
    // This fires immediately so the workspace summary and repository preview
    // are visible while Stage 3 content acquisition runs in the background.
    const metadata = this.fileInventory.buildMetadata(files);
    this.workspaceProfile = this.workspaceClassifier.classify(metadata);
    this.currentWorkspace.set(this.workspaceProfile, files);
    this.workspaceReady.emit(this.workspaceProfile);

    // Stage 3: async knowledge pipeline — starts after workspaceReady so the
    // UI can render the structure panels before file reading begins.
    const profile = this.workspaceProfile;
    this.knowledgeService.build(files, profile).then(knowledge => {
      this.zone.run(() => {
        this.knowledgeReady.emit(knowledge);
        this.cdr.detectChanges();
      });
    });

    // Load the primary file into the editor
    const primaryFile = this.selectPrimaryFile(files);
    this.fileName = primaryFile.name;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.code = content;
      this.isLoadingFile = false;
      this.lastAnalyzedLabel = null;

      const lang = this.languageFromFileName(primaryFile.name)
        ?? this.languageFromContent(content);
      this.applyMonacoLanguage(lang);

      this.editorInstance?.setValue(content);
      this.cdr.detectChanges();
    };
    reader.readAsText(primaryFile);
  }

  // Pick the most representative file to show in the editor
  private selectPrimaryFile(files: File[]): File {
    // Prefer source code files over project/config files
    const sourceExtensions = new Set(['cs', 'ts', 'js', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cpp', 'c']);
    const sourceFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return sourceExtensions.has(ext);
    });
    return sourceFile ?? files[0];
  }

  // Skip build artifacts, hidden directories, and binary assets when uploading folders
  private isIgnoredPath(file: File): boolean {
    const path = (file as any).webkitRelativePath || file.name;
    const segments = path.split('/');
    const ignoredDirs = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', '.angular', 'coverage', '.nyc_output']);
    return segments.some((seg: string) => ignoredDirs.has(seg));
  }

  async analyzeCode(): Promise<void> {
    if (!this.code.trim() || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.aiError = null;
    this.cdr.detectChanges();

    // Step 1: pattern-based analysis runs synchronously and always succeeds.
    // This gives the panel something to render immediately while AI is in flight.
    const patternResult = this.analysisService.analyze(this.code);
    const session: AnalysisSession = {
      fileName: this.fileName,
      sourceCode: this.code,
      analysis: patternResult,
      createdAt: new Date().toISOString(),
      workspaceContext: this.workspaceProfile ?? undefined,
    };
    this.analyze.emit(session);
    this.cdr.detectChanges();

    // Step 2: attempt AI enrichment. On any failure, the session already has
    // pattern-based content so the user is never left with an empty panel.
    try {
      const aiResult = await firstValueFrom(
        this.aiAnalysisService.analyze(this.fileName, this.code)
      );
      const enrichedSession: AnalysisSession = { ...session, aiAnalysis: aiResult };
      this.analyze.emit(enrichedSession);
      this.lastAnalyzedLabel = `AI · ${aiResult.model}`;
    } catch {
      // AI unavailable — pattern-based results remain visible, no crash.
      this.aiError = 'AI analysis unavailable. Showing pattern-based results.';
      this.lastAnalyzedLabel = 'Just now';
    } finally {
      this.isAnalyzing = false;
      this.cdr.detectChanges();
    }
  }

  // ─── Language detection ───────────────────────────────

  private languageFromFileName(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_LANGUAGE_MAP[ext] ?? 'plaintext';
  }

  private languageFromContent(code: string): string {
    if (!code?.trim()) return 'plaintext';

    // C# / .NET heuristics
    if (code.includes('using System') || code.includes('namespace ') ||
        (code.includes('public class') && code.includes('{'))) return 'csharp';

    // TypeScript / Angular
    if (code.includes('@Component') || code.includes('@NgModule') ||
        code.includes('@Injectable') || code.includes('import {')) return 'typescript';

    // Generic TypeScript / JavaScript
    if (code.includes('export class') || code.includes('export default') ||
        code.includes('export const') || code.includes('export function')) return 'typescript';

    // HTML
    if (code.trimStart().startsWith('<!DOCTYPE') ||
        code.trimStart().startsWith('<html') ||
        (code.includes('<div') && code.includes('</div>'))) return 'html';

    // SQL
    const upper = code.toUpperCase();
    if (upper.includes('SELECT ') && (upper.includes(' FROM ') || upper.includes('\nFROM '))) return 'sql';
    if (upper.includes('INSERT INTO') || upper.includes('CREATE TABLE')) return 'sql';

    // JSON
    if ((code.trimStart().startsWith('{') || code.trimStart().startsWith('[')) &&
        (code.trimEnd().endsWith('}') || code.trimEnd().endsWith(']'))) {
      try { JSON.parse(code); return 'json'; } catch { /* not valid JSON */ }
    }

    // XML / HTML-like
    if (code.trimStart().startsWith('<?xml') || code.trimStart().startsWith('<Project')) return 'xml';

    return 'plaintext';
  }

  private applyMonacoLanguage(language: string): void {
    this.currentMonacoLanguage = language;
    if (!this.editorInstance) return;
    const model = this.editorInstance.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (monaco) {
      monaco.editor.setModelLanguage(model, language);
    }
    this.cdr.detectChanges();
  }
}
