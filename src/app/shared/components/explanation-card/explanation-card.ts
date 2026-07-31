import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';

@Component({
  selector: 'app-explanation-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explanation-card.html',
  styleUrl: './explanation-card.scss',
})
export class ExplanationCard {
  @Input() title = '';
  @Input() entry: LLMSummaryEntry | null = null;
  @Input() isGenerating = false;
  @Input() noProvider = false;

  @Output() readonly regenerate = new EventEmitter<void>();
  @Output() readonly dismiss = new EventEmitter<void>();

  get status(): 'loading' | 'no-provider' | 'ready' | 'complete' | 'stale' | 'failed' {
    if (this.isGenerating) return 'loading';
    if (this.noProvider)   return 'no-provider';
    if (!this.entry)       return 'ready';
    return this.entry.status === 'complete' ? 'complete'
         : this.entry.status === 'stale'    ? 'stale'
         : 'failed';
  }

  get paragraphs(): string[] {
    const text = this.entry?.content;
    if (!text) return [];
    return text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  isHeading(para: string): boolean {
    return para.startsWith('#');
  }

  headingText(para: string): string {
    return para.replace(/^#{1,3}\s*/, '');
  }
}
