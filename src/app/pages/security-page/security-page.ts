import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { RiskItem } from '../../models/risk-item.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

interface SecurityCategory {
  key: string;
  label: string;
  keywords: string[];
  owasp?: string;
  owaspLabel?: string;
}

const SECURITY_CATEGORIES: SecurityCategory[] = [
  { key: 'injection',   label: 'Injection Risk',    keywords: ['inject','sql','command','script','xss'],                          owasp: 'A03', owaspLabel: 'Injection' },
  { key: 'auth',        label: 'Authentication',     keywords: ['auth','login','password','credential','token','session'],         owasp: 'A07', owaspLabel: 'Auth Failures' },
  { key: 'access',      label: 'Authorization',      keywords: ['authoriz','access','permission','role','privilege'],              owasp: 'A01', owaspLabel: 'Broken Access Control' },
  { key: 'validation',  label: 'Input Validation',   keywords: ['validat','sanitiz','input','null','empty','guard'] },
  { key: 'exposure',    label: 'Data Exposure',       keywords: ['secret','key','password','sensitive','encrypt','hash','hardcod'] },
  { key: 'logging',     label: 'Logging & Auditing', keywords: ['log','audit','track','monitor','record'] },
];

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss'
})
export class SecurityPage implements OnInit {

  session: AnalysisSession | null = null;
  readonly categories = SECURITY_CATEGORIES;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get allRisks(): RiskItem[] {
    return this.session?.analysis.risks ?? [];
  }

  get highRisks(): RiskItem[] {
    return this.allRisks.filter(r => r.severity === 'high');
  }

  get mediumRisks(): RiskItem[] {
    return this.allRisks.filter(r => r.severity === 'medium');
  }

  get lowRisks(): RiskItem[] {
    return this.allRisks.filter(r => r.severity === 'low');
  }

  get securityScore(): number {
    const penalty = this.highRisks.length * 18 + this.mediumRisks.length * 9 + this.lowRisks.length * 3;
    return Math.max(0, 100 - penalty);
  }

  get securityRating(): string {
    const s = this.securityScore;
    if (s >= 85) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Fair';
    return 'Poor';
  }

  get securityScoreClass(): string {
    const s = this.securityScore;
    if (s >= 85) return 'score-good';
    if (s >= 70) return 'score-ok';
    if (s >= 50) return 'score-warn';
    return 'score-bad';
  }

  categoryStatus(cat: SecurityCategory): 'pass' | 'warn' | 'fail' {
    const matched = this.allRisks.filter(r =>
      cat.keywords.some(k => r.description.toLowerCase().includes(k))
    );
    if (!matched.length) return 'pass';
    if (matched.some(r => r.severity === 'high')) return 'fail';
    return 'warn';
  }

  risksForCategory(cat: SecurityCategory): RiskItem[] {
    return this.allRisks.filter(r =>
      cat.keywords.some(k => r.description.toLowerCase().includes(k))
    );
  }
}
