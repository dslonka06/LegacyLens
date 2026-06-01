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

  @Input()
  session: AnalysisSession | null = null;

  get analysis(): AnalysisResult | null {
    return this.session?.analysis ?? null;
  }

  constructor(private readonly router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
