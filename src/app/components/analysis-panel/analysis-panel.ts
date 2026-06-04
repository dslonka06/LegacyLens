import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { AnalysisResult } from '../../models/analysis-result.model';

@Component({
  selector: 'app-analysis-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analysis-panel.html',
  styleUrl: './analysis-panel.scss'
})
export class AnalysisPanel {

  @Input() session: AnalysisSession | null = null;

  simplerOpen = false;

  get analysis(): AnalysisResult | null {
    return this.session?.analysis ?? null;
  }

  get complexityWidth(): string {
    const map: Record<string, string> = {
      low: '25%', medium: '55%', high: '80%', critical: '100%'
    };
    return map[this.analysis?.complexity.toLowerCase() ?? ''] ?? '50%';
  }

  get maintainabilityWidth(): string {
    const map: Record<string, string> = {
      high: '85%', medium: '50%', low: '20%'
    };
    return map[this.analysis?.maintainability.toLowerCase() ?? ''] ?? '50%';
  }

  constructor(private readonly router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  toggleSimpler(): void {
    this.simplerOpen = !this.simplerOpen;
  }

  copyBusinessPurpose(): void {
    if (this.analysis?.businessPurpose) {
      navigator.clipboard.writeText(this.analysis.businessPurpose).catch(() => {});
    }
  }
}
