import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import {
  RecommendationAnalysis,
  Recommendation,
} from '@app/analysis/models/recommendation-analysis.model';
import { Workspace } from '@app/workspace/models/workspace-entity.model';
import { SecurityFinding, SecuritySeverity } from '@app/analysis/models/security-analysis.model';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';

@Component({
  selector: 'app-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, ThemeToggle, ExplanationCard],
  templateUrl: './code-recommendations-page.html',
  styleUrl: './code-recommendations-page.scss',
})
export class CodeRecommendationsPage implements OnInit, OnDestroy {
  workspace: Workspace | null = null;
  showSummaryInfo = false;
  showSecFixesInfo = false;
  showRecsInfo = false;

  get recs(): RecommendationAnalysis | null {
    return this.workspace?.knowledgeModel?.ai?.recommendations ?? null;
  }

  get hasWorkspace(): boolean {
    return this.workspace?.knowledgeModel != null;
  }

  expandedRecs = new Set<string>();

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.workspace = this.manager.getActive();
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.workspace = ws;
      this.expandedRecs.clear();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleRec(id: string): void {
    if (this.expandedRecs.has(id)) {
      this.expandedRecs.delete(id);
    } else {
      this.expandedRecs.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedRecs.has(id);
  }

  priorityClass(rec: Recommendation): string {
    return `priority-${rec.priority}`;
  }

  priorityLabel(rec: Recommendation): string {
    return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[rec.priority] ?? rec.priority;
  }

  categoryLabel(rec: Recommendation): string {
    return ({
      architecture:     'Architecture',
      maintainability:  'Maintainability',
      modernization:    'Modernization',
      reliability:      'Reliability',
      performance:      'Performance',
      complexity:       'Complexity',
      'technical-debt': 'Technical Debt',
    })[rec.category] ?? rec.category;
  }

  get criticalCount(): number {
    const recCritical = this.recs?.recommendations?.filter(r => r.priority === 'critical').length ?? 0;
    const secCritical = this.workspace?.knowledgeModel?.ai?.security?.findings?.filter(f => f.severity === 'critical').length ?? 0;
    return recCritical + secCritical;
  }

  get highCount(): number {
    const recHigh = this.recs?.recommendations?.filter(r => r.priority === 'high').length ?? 0;
    const secHigh = this.workspace?.knowledgeModel?.ai?.security?.findings?.filter(f => f.severity === 'high').length ?? 0;
    return recHigh + secHigh;
  }

  get mediumCount(): number {
    const recMedium = this.recs?.recommendations?.filter(r => r.priority === 'medium').length ?? 0;
    const secMedium = this.workspace?.knowledgeModel?.ai?.security?.findings?.filter(f => f.severity === 'medium').length ?? 0;
    return recMedium + secMedium;
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.workspace?.knowledgeModel?.ai?.summaries?.recommendations ?? null;
  }

  get securityActionItems(): SecurityFinding[] {
    const findings = this.workspace?.knowledgeModel?.ai?.security?.findings ?? [];
    return findings
      .filter(f => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium')
      .sort((a, b) => {
        const order: Record<SecuritySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      })
      .slice(0, 8);
  }

  get hasSecurityActionItems(): boolean {
    return this.securityActionItems.length > 0;
  }

  expandedSecurityIds = new Set<string>();

  toggleSecurityItem(id: string): void {
    if (this.expandedSecurityIds.has(id)) {
      this.expandedSecurityIds.delete(id);
    } else {
      this.expandedSecurityIds.add(id);
    }
  }

  isSecurityItemExpanded(id: string): boolean {
    return this.expandedSecurityIds.has(id);
  }

  securitySeverityClass(s: SecuritySeverity): string {
    return { critical: 'priority-critical', high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }[s] ?? 'priority-low';
  }

  securitySeverityLabel(s: SecuritySeverity): string {
    return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[s] ?? s;
  }
}
