import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { AnalysisService } from '../../services/analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';

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

  editorOptions = {
    theme: 'vs-dark',
    language: 'plaintext',
    fontSize: 13,
    fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
    fontLigatures: true,
    lineNumbers: 'on' as const,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off' as const,
    renderWhitespace: 'none' as const,
    folding: true,
    lineDecorationsWidth: 4,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 14, bottom: 14 },
    fixedOverflowWidgets: true,
  };

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone
  ) {}

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
        this.updateLanguage(this.restoredSourceCode);
      }
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.editorInstance?.dispose();
  }

  get detectedLanguage(): string {
    return this.detectLanguage(this.code);
  }

  get lineCount(): number {
    return this.code ? this.code.split('\n').length : 1;
  }

  onEditorInit(editor: any): void {
    this.zone.run(() => {
      this.editorInstance = editor;

      if (this.code) {
        editor.setValue(this.code);
        this.updateLanguage(this.code);
      }

      editor.onDidChangeModelContent(() => {
        this.zone.run(() => {
          this.code = editor.getValue();
          this.updateLanguage(this.code);
          this.cdr.detectChanges();
        });
      });
    });
  }

  clearFile(): void {
    this.code = '';
    this.fileName = 'untitled.txt';
    this.lastAnalyzedLabel = null;
    this.editorInstance?.setValue('');
    this.setMonacoLanguage('plaintext');
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
      this.editorInstance?.setValue(content);
      this.updateLanguage(content);
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

  private detectLanguage(code: string): string {
    if (!code) return 'Auto';
    if (code.includes('[ApiController]') || (code.includes('Controller') && code.includes('class'))) return 'C#';
    if (code.includes('@Component') || code.includes('export class')) return 'TypeScript';
    if (code.toUpperCase().includes('SELECT')) return 'SQL';
    if (code.includes('interface ')) return 'C#';
    return 'Auto';
  }

  private detectMonacoLanguage(code: string): string {
    if (!code) return 'plaintext';
    if (code.includes('[ApiController]') || (code.includes('Controller') && code.includes('class'))) return 'csharp';
    if (code.includes('@Component') || code.includes('export class')) return 'typescript';
    if (code.toUpperCase().includes('SELECT')) return 'sql';
    if (code.includes('interface ')) return 'csharp';
    return 'plaintext';
  }

  private updateLanguage(code: string): void {
    this.setMonacoLanguage(this.detectMonacoLanguage(code));
  }

  private setMonacoLanguage(language: string): void {
    if (!this.editorInstance) return;
    const model = this.editorInstance.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (monaco) {
      monaco.editor.setModelLanguage(model, language);
    }
  }
}
