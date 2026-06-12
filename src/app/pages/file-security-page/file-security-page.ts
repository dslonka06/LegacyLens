import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SecurityAnalysis, SecurityFinding, SecurityFindingCategory, SecuritySeverity } from '../../models/security-analysis.model';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';

@Component({
  selector: 'app-file-security-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-security-page.html',
  styleUrl: './file-security-page.scss',
})
export class FileSecurityPage implements OnInit, OnDestroy {

  security: SecurityAnalysis | null = null;
  hasWorkspace = false;
  expandedFindings = new Set<string>();

  private subs: Subscription[] = [];

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly workspace: CurrentWorkspaceService,
  ) {}

  ngOnInit(): void {
    this.security = this.manager.getActive()?.securityAnalysis ?? null;
    this.hasWorkspace = this.workspace.context !== null;

    this.subs.push(
      this.manager.activeWorkspace$.subscribe(ws => {
        this.security = ws?.securityAnalysis ?? null;
        this.hasWorkspace = this.workspace.context !== null;
      }),
      this.workspace.context$.subscribe(ctx => {
        this.hasWorkspace = ctx !== null;
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

  get mediumFindings(): SecurityFinding[] {
    return this.security?.findings.filter(f => f.severity === 'medium') ?? [];
  }

  get lowFindings(): SecurityFinding[] {
    return this.security?.findings.filter(f => f.severity === 'low') ?? [];
  }

  get findingsByCategory(): { category: SecurityFindingCategory; label: string; findings: SecurityFinding[] }[] {
    if (!this.security?.findings.length) return [];
    const map = new Map<SecurityFindingCategory, SecurityFinding[]>();
    for (const f of this.security.findings) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    const result = [];
    for (const [cat, findings] of map.entries()) {
      result.push({ category: cat, label: this.categoryLabel(cat), findings });
    }
    return result.sort((a, b) => this.categorySortOrder(a.category) - this.categorySortOrder(b.category));
  }

  severityClass(s: SecuritySeverity): string {
    return ({ critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' })[s] ?? 'sev-low';
  }

  riskClass(s: SecuritySeverity): string {
    return ({ critical: 'risk-critical', high: 'risk-high', medium: 'risk-medium', low: 'risk-low' })[s] ?? 'risk-low';
  }

  maturityClass(m: string): string {
    return ({ 'Low': 'maturity-low', 'Medium': 'maturity-medium', 'High': 'maturity-high' })[m] ?? 'maturity-medium';
  }

  categoryLabel(cat: SecurityFindingCategory): string {
    const labels: Record<SecurityFindingCategory, string> = {
      'secrets-management': 'Secrets Management',
      'authentication': 'Authentication',
      'authorization': 'Authorization',
      'input-validation': 'Input Validation',
      'sql-injection': 'SQL Injection',
      'file-access': 'File Access',
      'external-calls': 'External Calls',
      'configuration': 'Configuration',
      'broad-access': 'Broad Access',
      'ai-finding': 'AI Findings',
    };
    return labels[cat] ?? cat;
  }

  categoryIcon(cat: SecurityFindingCategory): string {
    const icons: Record<SecurityFindingCategory, string> = {
      'secrets-management': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      'authentication': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      'authorization': 'M12 1l9.5 3.5v8c0 5.25-4.02 9.15-9.5 11-5.48-1.85-9.5-5.75-9.5-11v-8z',
      'input-validation': 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      'sql-injection': 'M4 6h16M4 10h16M4 14h16M4 18h16',
      'file-access': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'external-calls': 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3',
      'configuration': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'broad-access': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'ai-finding': 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M12 21v-1',
    };
    return icons[cat] ?? 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
  }

  private categorySortOrder(cat: SecurityFindingCategory): number {
    const order: SecurityFindingCategory[] = [
      'secrets-management', 'authentication', 'authorization',
      'sql-injection', 'input-validation', 'file-access',
      'external-calls', 'configuration', 'broad-access', 'ai-finding',
    ];
    const idx = order.indexOf(cat);
    return idx === -1 ? 99 : idx;
  }
}
