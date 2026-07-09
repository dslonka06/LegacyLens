import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SecurityAnalysis, SecurityFinding, SecuritySeverity } from '@app/analysis/models/security-analysis.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

@Component({
  selector: 'app-repository-security-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-security-page.html',
  styleUrl: './repository-security-page.scss',
})
export class RepositorySecurityPage implements OnInit, OnDestroy {

  security: SecurityAnalysis | null = null;
  securityOverview: string | null = null;
  overviewLoading = false;
  hasWorkspace = false;
  expandedFindings = new Set<string>();

  readonly SEVERITY_ORDER: SecuritySeverity[] = ['critical', 'high', 'medium', 'low'];

  private subs: Subscription[] = [];

  constructor(
    private readonly manager: WorkspaceManagerService,
  ) {}

  ngOnInit(): void {
    const active = this.manager.getActive();
    this.security = active?.knowledgeModel?.ai?.security ?? null;
    this.securityOverview = active?.knowledgeModel?.ai?.securityOverview ?? null;
    this.overviewLoading = this.security !== null && this.securityOverview === null;
    this.hasWorkspace = active?.knowledgeModel != null;

    this.subs.push(
      this.manager.activeWorkspace$.subscribe(ws => {
        this.security = ws?.knowledgeModel?.ai?.security ?? null;
        this.securityOverview = ws?.knowledgeModel?.ai?.securityOverview ?? null;
        this.overviewLoading = this.security !== null && this.securityOverview === null;
        this.hasWorkspace = ws?.knowledgeModel != null;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleFinding(id: string): void {
    if (this.expandedFindings.has(id)) {
      this.expandedFindings.delete(id);
    } else {
      this.expandedFindings.add(id);
    }
  }

  isFindingExpanded(id: string): boolean {
    return this.expandedFindings.has(id);
  }

  get criticalFindings(): SecurityFinding[] {
    return this.security?.findings.filter(f => f.severity === 'critical') ?? [];
  }

  get highFindings(): SecurityFinding[] {
    return this.security?.findings.filter(f => f.severity === 'high') ?? [];
  }

  get findingsBySeverity(): { severity: SecuritySeverity; findings: SecurityFinding[] }[] {
    if (!this.security?.findings.length) return [];
    return this.SEVERITY_ORDER
      .map(sev => ({ severity: sev, findings: this.security!.findings.filter(f => f.severity === sev) }))
      .filter(g => g.findings.length > 0);
  }

  severityClass(s: SecuritySeverity): string {
    return ({ critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' })[s] ?? 'sev-low';
  }

  severityLabel(s: SecuritySeverity): string {
    return ({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' })[s] ?? s;
  }

  riskClass(s: SecuritySeverity): string {
    return ({ critical: 'risk-critical', high: 'risk-high', medium: 'risk-medium', low: 'risk-low' })[s] ?? 'risk-low';
  }

  maturityClass(m: string): string {
    return ({ 'Low': 'maturity-low', 'Medium': 'maturity-medium', 'High': 'maturity-high' })[m] ?? 'maturity-medium';
  }
}
