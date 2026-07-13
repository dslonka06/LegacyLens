import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  ValidationResult,
  AnalysisTarget,
} from '@app/core/services/target-validation.service';

@Component({
  selector: 'app-validation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './validation-dialog.html',
  styleUrl: './validation-dialog.scss',
})
export class ValidationDialog {
  @Input() result!: ValidationResult;
  @Output() proceed = new EventEmitter<AnalysisTarget>();
  @Output() cancel = new EventEmitter<void>();

  get intendedLabel(): string {
    return this.analysisLabel(this.result.intended);
  }
  get suggestedLabel(): string {
    return this.analysisLabel(this.result.suggestion ?? this.result.intended);
  }

  private analysisLabel(t: AnalysisTarget): string {
    if (t === 'file') return 'File Analysis';
    if (t === 'folder') return 'Folder Analysis';
    return 'Repository Analysis';
  }

  onProceedWithSuggestion(): void {
    this.proceed.emit(this.result.suggestion ?? this.result.intended);
  }

  onProceedWithOriginal(): void {
    this.proceed.emit(this.result.intended);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
