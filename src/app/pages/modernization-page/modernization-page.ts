import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { ModernizationRecommendation } from '../../models/modernization-recommendation.model';
import { ModernizationItem } from '../../models/modernization-item.model';

@Component({
  selector: 'app-modernization-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modernization-page.html',
  styleUrl: './modernization-page.scss'
})
export class ModernizationPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get isAiPowered(): boolean {
    return (this.session?.aiAnalysis?.modernizations?.length ?? 0) > 0;
  }

  // All recommendations normalised to { title, description }
  // AI source preferred; pattern-based fallback otherwise.
  get recommendations(): { title: string; description: string }[] {
    if (this.isAiPowered) {
      return (this.session!.aiAnalysis!.modernizations as ModernizationRecommendation[]).map(m => ({
        title: m.title,
        description: m.description
      }));
    }
    return (this.session?.analysis.modernizationSuggestions ?? []).map((m: ModernizationItem) => ({
      title: m.description,
      description: m.description
    }));
  }

  get totalCount(): number {
    return this.recommendations.length;
  }

  goToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
