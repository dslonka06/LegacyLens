import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
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

  get highPriority(): ModernizationItem[] {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'high') ?? [];
  }

  get mediumPriority(): ModernizationItem[] {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'medium') ?? [];
  }

  get lowPriority(): ModernizationItem[] {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'low') ?? [];
  }

  get totalCount(): number {
    return this.session?.analysis.modernizationSuggestions.length ?? 0;
  }

  goToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
