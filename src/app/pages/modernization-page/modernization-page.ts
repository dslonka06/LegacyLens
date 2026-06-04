import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';
import { ModernizationItem } from '../../models/modernization-item.model';

// Category keywords for grouping suggestions
const CATEGORY_PATTERNS: { label: string; keywords: string[] }[] = [
  { label: 'Performance',    keywords: ['async', 'await', 'cache', 'performance', 'lazy', 'query', 'index', 'bulk', 'batch', 'parallel'] },
  { label: 'Architecture',   keywords: ['pattern', 'layer', 'interface', 'abstract', 'inject', 'dependency', 'repository', 'service', 'handler', 'mediator'] },
  { label: 'Code Quality',   keywords: ['naming', 'refactor', 'extract', 'simplif', 'duplicat', 'magic string', 'enum', 'const', 'clean', 'solid', 'single'] },
  { label: 'Security',       keywords: ['secret', 'encrypt', 'hash', 'auth', 'token', 'valid', 'sanitiz', 'sql injection', 'xss', 'cors'] },
  { label: 'Maintainability',keywords: ['comment', 'document', 'log', 'test', 'coverage', 'null check', 'guard', 'exception', 'error handling', 'nullable'] },
];

function categorize(desc: string): string {
  const lower = desc.toLowerCase();
  for (const cat of CATEGORY_PATTERNS) {
    if (cat.keywords.some(k => lower.includes(k))) return cat.label;
  }
  return 'Other';
}

@Component({
  selector: 'app-modernization-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modernization-page.html',
  styleUrl: './modernization-page.scss'
})
export class ModernizationPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(
    private readonly currentAnalysis: CurrentAnalysisService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get totalCount(): number {
    return this.session?.analysis.modernizationSuggestions.length ?? 0;
  }

  get categories(): { label: string; items: (ModernizationItem & { category: string })[] }[] {
    if (!this.session) return [];
    const grouped = new Map<string, ModernizationItem[]>();
    for (const item of this.session.analysis.modernizationSuggestions) {
      const cat = categorize(item.description);
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(item);
    }
    // Sort: high priority items first within each group
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return Array.from(grouped.entries()).map(([label, items]) => ({
      label,
      items: [...items].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)) as any
    }));
  }

  get highCount(): number {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'high').length ?? 0;
  }

  get mediumCount(): number {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'medium').length ?? 0;
  }

  get lowCount(): number {
    return this.session?.analysis.modernizationSuggestions.filter(s => s.priority === 'low').length ?? 0;
  }

  impactLabel(priority: string): string {
    return priority === 'high' ? 'High Impact' : priority === 'medium' ? 'Medium Impact' : 'Low Impact';
  }

  effortLabel(priority: string): string {
    // Invert: high-priority items are typically lower-effort quick wins
    return priority === 'high' ? 'Low Effort' : priority === 'medium' ? 'Medium Effort' : 'Higher Effort';
  }

  goToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
