import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.scss'
})
export class ArchitecturePage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get isAiPowered(): boolean {
    const arch = this.session?.aiAnalysis?.architecture;
    return !!(arch && (
      arch.patterns.length > 0 ||
      arch.responsibilities.length > 0 ||
      arch.dependencies.length > 0
    ));
  }

  // Prefer AI patterns; fall back to pattern-based analysis
  get patterns(): string[] {
    if (this.isAiPowered)
      return this.session!.aiAnalysis!.architecture.patterns;
    return this.session?.analysis.patterns ?? [];
  }

  get responsibilities(): string[] {
    if (this.isAiPowered)
      return this.session!.aiAnalysis!.architecture.responsibilities;
    return this.session?.analysis.responsibilities ?? [];
  }

  get dependencies(): string[] {
    if (this.isAiPowered)
      return this.session!.aiAnalysis!.architecture.dependencies;
    return this.session?.analysis.dependencies ?? [];
  }
}
