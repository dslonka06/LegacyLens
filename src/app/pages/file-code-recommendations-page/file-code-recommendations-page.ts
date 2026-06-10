import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { AiRisk } from '../../models/ai-analysis-result.model';
import { ModernizationRecommendation } from '../../models/modernization-recommendation.model';
import { ModernizationItem } from '../../models/modernization-item.model';

interface Recommendation {
  category: 'issue' | 'security' | 'modernization';
  title: string;
  severity: string;
  description: string;
  source: 'ai' | 'pattern';
}

@Component({
  selector: 'app-file-code-recommendations-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-code-recommendations-page.html',
  styleUrl: './file-code-recommendations-page.scss'
})
export class FileCodeRecommendationsPage implements OnInit {

  session: AnalysisSession | null = null;
  expandedItems = new Set<number>();

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get isAiPowered(): boolean {
    return (this.session?.aiAnalysis?.risks?.length ?? 0) > 0
      || (this.session?.aiAnalysis?.modernizations?.length ?? 0) > 0;
  }

  get allRecommendations(): Recommendation[] {
    const items: Recommendation[] = [];

    // Issues / Risks
    if ((this.session?.aiAnalysis?.risks?.length ?? 0) > 0) {
      (this.session!.aiAnalysis!.risks as AiRisk[]).forEach(r => items.push({
        category: 'issue',
        title: r.title,
        severity: r.severity.toLowerCase(),
        description: r.description,
        source: 'ai',
      }));
    } else {
      (this.session?.analysis.risks ?? []).forEach(r => items.push({
        category: 'issue',
        title: r.description,
        severity: r.severity,
        description: r.description,
        source: 'pattern',
      }));
    }

    // Modernization
    if ((this.session?.aiAnalysis?.modernizations?.length ?? 0) > 0) {
      (this.session!.aiAnalysis!.modernizations as ModernizationRecommendation[]).forEach(m => items.push({
        category: 'modernization',
        title: m.title,
        severity: 'info',
        description: m.description,
        source: 'ai',
      }));
    } else {
      (this.session?.analysis.modernizationSuggestions ?? []).map((m: ModernizationItem) => items.push({
        category: 'modernization',
        title: m.description,
        severity: 'info',
        description: m.description,
        source: 'pattern',
      }));
    }

    return items;
  }

  get issueCount():        number { return this.allRecommendations.filter(r => r.category === 'issue').length; }
  get modernizationCount():number { return this.allRecommendations.filter(r => r.category === 'modernization').length; }
  get highCount():         number { return this.allRecommendations.filter(r => r.severity === 'high').length; }

  severityClass(severity: string): string {
    const map: Record<string, string> = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low', info: 'sev-info' };
    return map[severity] ?? 'sev-info';
  }

  categoryClass(cat: string): string {
    const map: Record<string, string> = { issue: 'cat-issue', security: 'cat-security', modernization: 'cat-modern' };
    return map[cat] ?? 'cat-issue';
  }

  categoryLabel(cat: string): string {
    const map: Record<string, string> = { issue: 'Issue', security: 'Security', modernization: 'Modernization' };
    return map[cat] ?? 'Issue';
  }

  toggleItem(i: number): void {
    if (this.expandedItems.has(i)) this.expandedItems.delete(i);
    else this.expandedItems.add(i);
  }

  isExpanded(i: number): boolean { return this.expandedItems.has(i); }
}
