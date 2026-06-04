import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { AiRisk } from '../../models/ai-analysis-result.model';

// Unified risk shape used throughout the page regardless of source
interface DisplayRisk {
  title: string;
  severity: string;   // 'high' | 'medium' | 'low' (lower-cased)
  description: string;
  source: 'ai' | 'pattern';
}

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

  get isAiPowered(): boolean {
    return (this.session?.aiAnalysis?.risks?.length ?? 0) > 0;
  }

  // All risks normalised to DisplayRisk, preferring AI source
  get allRisks(): DisplayRisk[] {
    if (this.isAiPowered) {
      return (this.session!.aiAnalysis!.risks as AiRisk[]).map(r => ({
        title:       r.title,
        severity:    r.severity.toLowerCase(),
        description: r.description,
        source:      'ai' as const
      }));
    }
    return (this.session?.analysis.risks ?? []).map(r => ({
      title:       r.description,
      severity:    r.severity,
      description: r.description,
      source:      'pattern' as const
    }));
  }

  get highRisks():   DisplayRisk[] { return this.allRisks.filter(r => r.severity === 'high'); }
  get mediumRisks(): DisplayRisk[] { return this.allRisks.filter(r => r.severity === 'medium'); }
  get lowRisks():    DisplayRisk[] { return this.allRisks.filter(r => r.severity === 'low'); }

  get totalCount(): number { return this.allRisks.length; }

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
