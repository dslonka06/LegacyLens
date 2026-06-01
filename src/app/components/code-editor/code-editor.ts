import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from '../../services/analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss'
})
export class CodeEditor implements OnChanges {

  @Input() restoredFileName: string | null = null;
  @Input() restoredSourceCode: string | null = null;

  @Output() analyze = new EventEmitter<AnalysisSession>();

  code = '';
  fileName = 'untitled.txt';
  isAnalyzing = false;
  isLoadingFile = false;

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['restoredFileName'] && this.restoredFileName) {
      this.fileName = this.restoredFileName;
    }
    if (changes['restoredSourceCode'] && this.restoredSourceCode !== null) {
      this.code = this.restoredSourceCode;
      this.cdr.detectChanges();
    }
  }

  get lineCount(): number {
    return this.code ? this.code.split('\n').length : 1;
  }

  get lineNumbers(): number[] {
    return Array.from({ length: this.lineCount }, (_, i) => i + 1);
  }

  get detectedLanguage(): string {
    if (!this.code) return 'Auto';
    if (this.code.includes('[ApiController]') || (this.code.includes('Controller') && this.code.includes('class'))) return 'C#';
    if (this.code.includes('@Component') || this.code.includes('export class')) return 'TypeScript';
    if (this.code.toUpperCase().includes('SELECT')) return 'SQL';
    if (this.code.includes('interface ')) return 'C#';
    return 'Auto';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.isLoadingFile = true;

    const reader = new FileReader();
    reader.onload = () => {
      this.code = reader.result as string;
      this.isLoadingFile = false;
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
    this.isAnalyzing = false;
  }

  onTextareaScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const gutter = textarea.closest('.editor-body')?.querySelector('.line-gutter') as HTMLElement | null;
    if (gutter) gutter.scrollTop = textarea.scrollTop;
  }
}
