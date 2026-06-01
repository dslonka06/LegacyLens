import { Component, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from '../../services/analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss'
})
export class CodeEditor {

  code = '';
  fileName = 'untitled.txt';
  isLoadingFile = false;

  @Output()
  analyze = new EventEmitter<AnalysisSession>();

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

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
    if (!this.code.trim()) {
      return;
    }

    const result = this.analysisService.analyze(this.code);

    const session: AnalysisSession = {
      fileName: this.fileName,
      sourceCode: this.code,
      analysis: result,
      createdAt: new Date().toISOString()
    };

    this.analyze.emit(session);
  }
}
