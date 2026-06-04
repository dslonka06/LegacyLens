import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subscription } from 'rxjs';
import { AnalysisService } from '../../services/analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
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

  code = '';
  fileName = 'untitled.txt';
  isAnalyzing = false;
  isLoadingFile = false;
  lastAnalyzedLabel: string | null = null;

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

  constructor(
    private readonly analysisService: AnalysisService,
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

  get lineCount(): number {
    return this.code ? this.code.split('\n').length : 1;
  }

  onEditorInit(editor: any): void {
    this.zone.run(() => {
      this.editorInstance = editor;

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
          // Only fall back to content detection when no real filename is loaded
          if (this.fileName === 'untitled.txt') {
            this.applyMonacoLanguage(this.languageFromContent(this.code));
          }
          this.cdr.detectChanges();
        });
      });

      // Subscribe to theme changes and update Monaco immediately
      this.themeSub = this.themeService.isDark$.subscribe(isDark => {
        const monaco = (window as any).monaco;
        if (monaco) {
          monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        }
      });
    });
  }

  clearFile(): void {
    this.code = '';
    this.fileName = 'untitled.txt';
    this.lastAnalyzedLabel = null;
    this.currentMonacoLanguage = 'plaintext';
    this.editorInstance?.setValue('');
    this.applyMonacoLanguage('plaintext');
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.isLoadingFile = true;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.code = content;
      this.isLoadingFile = false;
      this.lastAnalyzedLabel = null;

      // Extension is the primary source; content is fallback for extensionless files
      const lang = this.languageFromFileName(file.name)
        ?? this.languageFromContent(content);
      this.applyMonacoLanguage(lang);

      this.editorInstance?.setValue(content);
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  analyzeCode(): void {
    if (!this.code.trim() || this.isAnalyzing) return;

    this.isAnalyzing = true;
    const result = this.analysisService.analyze(this.code);
    const session: AnalysisSession = {
      fileName: this.fileName,
      sourceCode: this.code,
      analysis: result,
      createdAt: new Date().toISOString()
    };
    this.analyze.emit(session);
    this.lastAnalyzedLabel = 'Just now';
    this.isAnalyzing = false;
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
