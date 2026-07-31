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

  debtClass(level: string): string {
    return `debt-${level.toLowerCase().replace(' ', '-')}`;
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.workspace?.knowledgeModel?.ai?.summaries?.recommendations ?? null;
  }
}
