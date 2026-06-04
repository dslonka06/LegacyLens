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
  expandedRisks = new Set<number>();

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

  get riskScore(): number {
    if (!this.totalCount) return 100;
    const penalty = this.highRisks.length * 20 + this.mediumRisks.length * 10 + this.lowRisks.length * 4;
    return Math.max(0, 100 - penalty);
  }

  get riskScoreLabel(): string {
    const s = this.riskScore;
    if (s >= 80) return 'Low Risk';
    if (s >= 60) return 'Moderate';
    if (s >= 40) return 'High Risk';
    return 'Critical';
  }

  get riskScoreClass(): string {
    const s = this.riskScore;
    if (s >= 80) return 'score-good';
    if (s >= 60) return 'score-warn';
    return 'score-bad';
  }

  toggleRisk(index: number): void {
    if (this.expandedRisks.has(index)) {
      this.expandedRisks.delete(index);
    } else {
      this.expandedRisks.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedRisks.has(index);
  }

  goToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
