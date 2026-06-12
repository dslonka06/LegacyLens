import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { RecommendationAnalysis, Recommendation } from '../../models/recommendation-analysis.model';
import { Workspace } from '../../models/workspace-entity.model';

@Component({
  selector: 'app-repository-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repository-code-recommendations-page.html',
  styleUrl: './repository-code-recommendations-page.scss',
})
export class RepositoryCodeRecommendationsPage implements OnInit, OnDestroy {

  workspace: Workspace | null = null;
  get recs(): RecommendationAnalysis | null { return this.workspace?.recommendationAnalysis ?? null; }
  get hasWorkspace(): boolean { return this.workspace !== null && (this.workspace.knowledge !== null || this.workspace.context !== null); }

  expandedRecs = new Set<string>();

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.workspace = this.manager.getActive();
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.workspace = ws;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleRec(id: string): void {
    if (this.expandedRecs.has(id)) this.expandedRecs.delete(id);
    else this.expandedRecs.add(id);
  }

  isExpanded(id: string): boolean { return this.expandedRecs.has(id); }

  priorityClass(rec: Recommendation): string {
    return `priority-${rec.priority}`;
  }

  priorityLabel(rec: Recommendation): string {
    return ({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' })[rec.priority] ?? rec.priority;
  }

  categoryLabel(rec: Recommendation): string {
    return ({
      architecture: 'Architecture',
      maintainability: 'Maintainability',
      modernization: 'Modernization',
      reliability: 'Reliability',
      performance: 'Performance',
      complexity: 'Complexity',
      'technical-debt': 'Technical Debt',
    })[rec.category] ?? rec.category;
  }

  debtClass(level: string): string {
    return `debt-${level.toLowerCase().replace(' ', '-')}`;
  }

  readinessClass(level: string): string {
    if (level === 'Ready') return 'readiness-ready';
    if (level === 'Partially Ready') return 'readiness-partial';
    return 'readiness-not-ready';
  }
}
