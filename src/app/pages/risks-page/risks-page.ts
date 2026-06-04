import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { RiskItem } from '../../models/risk-item.model';

@Component({
  selector: 'app-risks-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './risks-page.html',
  styleUrl: './risks-page.scss'
})
export class RisksPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get highRisks(): RiskItem[] {
    return this.session?.analysis.risks.filter(r => r.severity === 'high') ?? [];
  }

  get mediumRisks(): RiskItem[] {
    return this.session?.analysis.risks.filter(r => r.severity === 'medium') ?? [];
  }

  get lowRisks(): RiskItem[] {
    return this.session?.analysis.risks.filter(r => r.severity === 'low') ?? [];
  }

  get totalCount(): number {
    return this.session?.analysis.risks.length ?? 0;
  }

  goToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
