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

  readonly SEGMENTS = [1, 2, 3, 4, 5];

  get analysis(): AnalysisResult | null {
    return this.session?.analysis ?? null;
  }

  // How many segments to fill for complexity
  get complexityFilled(): number {
    const map: Record<string, number> = { low: 1, medium: 3, high: 4, critical: 5 };
    return map[this.analysis?.complexity.toLowerCase() ?? ''] ?? 2;
  }

  // How many segments to fill for maintainability
  get maintainabilityFilled(): number {
    const map: Record<string, number> = { high: 5, medium: 3, low: 1 };
    return map[this.analysis?.maintainability.toLowerCase() ?? ''] ?? 3;
  }

  // Per-segment color for complexity: low=green, medium starts yellow, high goes orange/red
  complexitySegmentClass(index: number): string {
    const level = this.analysis?.complexity.toLowerCase() ?? '';
    const filled = this.complexityFilled;
    if (index >= filled) return 'seg-empty';
    // Color ramp: green → yellow → orange → red
    const colors = ['seg-green', 'seg-yellow', 'seg-orange', 'seg-red', 'seg-red'];
    if (level === 'low') return 'seg-green';
    if (level === 'medium') return index < 2 ? 'seg-green' : 'seg-yellow';
    if (level === 'high') return colors[index];
    return colors[index]; // critical
  }

  // Per-segment color for maintainability: high=green ramp, low=red ramp
  maintainabilitySegmentClass(index: number): string {
    const level = this.analysis?.maintainability.toLowerCase() ?? '';
    const filled = this.maintainabilityFilled;
    if (index >= filled) return 'seg-empty';
    if (level === 'high') return index < 2 ? 'seg-green' : index < 4 ? 'seg-green' : 'seg-yellow';
    if (level === 'medium') return index < 2 ? 'seg-green' : 'seg-yellow';
    return 'seg-red'; // low
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
