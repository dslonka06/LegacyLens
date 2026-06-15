import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-explanation-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explanation-card.html',
  styleUrl: './explanation-card.scss',
})
export class ExplanationCard {
  @Input() title = '';
  @Input() content: string | null = null;
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() readonly dismiss = new EventEmitter<void>();

  get paragraphs(): string[] {
    if (!this.content) return [];
    // Split on double newline or markdown heading to produce readable paragraphs
    return this.content
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
