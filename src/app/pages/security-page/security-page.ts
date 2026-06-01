import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { RiskItem } from '../../models/risk-item.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss'
})
export class SecurityPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

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
}
