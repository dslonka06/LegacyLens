import { Component, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
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
export class CodeEditor {

  code = '';
  fileName = 'untitled.txt';
  isAnalyzing = false;
  isLoadingFile = false;

  @Output()
  analyze = new EventEmitter<AnalysisSession>();

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get lineCount(): number {
    if (!this.code) return 1;
    return this.code.split('\n').length;
  }

  get lineNumbers(): number[] {
    return Array.from({ length: this.lineCount }, (_, i) => i + 1);
  }

  get detectedLanguage(): string {
    if (this.code.includes('[ApiController]') || (this.code.includes('Controller') && this.code.includes('class'))) return 'C#';
    if (this.code.includes('@Component') || this.code.includes('export class')) return 'TypeScript';
    if (this.code.toUpperCase().includes('SELECT')) return 'SQL';
    if (this.code.includes('interface ') && !this.code.includes('export class')) return 'C#';
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
    const gutterEl = textarea.closest('.editor-body')?.querySelector('.line-gutter') as HTMLElement;
    if (gutterEl) {
      gutterEl.scrollTop = textarea.scrollTop;
    }
  }
}
