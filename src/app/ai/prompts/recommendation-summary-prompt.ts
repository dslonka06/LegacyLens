import { Injectable } from '@angular/core';
import type { RecommendationAnalysis } from '@app/analysis/models/recommendation-analysis.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

export interface RecommendationSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  recommendations: RecommendationAnalysis;
  architecture: ArchitectureAIAnalysis | null;
  totalFiles: number;
  languages: string[];
}

@Injectable({ providedIn: 'root' })
export class RecommendationSummaryPromptBuilder {
  build(ctx: RecommendationSummaryContext): string {
    const parts: string[] = [];
    const { recommendations: recs, architecture, scope } = ctx;

    const critical = recs.recommendations.filter(r => r.priority === 'critical');
    const high     = recs.recommendations.filter(r => r.priority === 'high');
    const byCategory = this._groupByCategory(recs.recommendations);
    const dominantCategory = this._dominantCategory(byCategory);
    const top3 = recs.recommendations.slice(0, 3);

    // ── Persona ───────────────────────────────────────────────────────────────
    parts.push(
      `You are a senior software architect who has just completed a structural analysis of a codebase.`,
      `You are writing a brief for the development team that owns this system.`,
      ``,
      `Your role is to reason about what the recommendation data reveals about how this codebase evolved`,
      `and what that means for the team. Do not list the recommendations — that list is shown elsewhere.`,
      `Do not restate the numbers. Interpret what they mean together.`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      `Do not prescribe specific fixes — describe the structural situation and its implications.`,
      ``,
    );

    // ── Output format ─────────────────────────────────────────────────────────
    if (scope === 'file') {
      parts.push(`Output: 1–2 sentences. What does the recommendation profile of this single file suggest about it?`);
    } else if (scope === 'folder') {
      parts.push(`Output: 2 short paragraphs, 80–130 words. What does the pattern of recommendations reveal about this codebase area?`);
    } else {
      parts.push(
        `Output: 3 paragraphs, 150–220 words.`,
        `Paragraph 1: What does the overall technical debt profile suggest about how this codebase grew — was it rushed, well-planned, or incrementally degraded?`,
        `Paragraph 2: What does the concentration of recommendations by category tell you about where the team's attention has historically gone and where it hasn't?`,
        `Paragraph 3: Given the architecture and debt profile together, what is the highest-leverage area of improvement — and why does that area matter more than the others?`,
      );
    }

    parts.push(``);

    // ── Evidence block ────────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);
    parts.push(`Size: ${ctx.totalFiles} files | Languages: ${ctx.languages.join(', ')}`);
    parts.push(``);
    parts.push(`Technical debt level: ${recs.technicalDebtLevel}`);
    parts.push(`Modernization readiness: ${recs.modernizationReadiness}`);
    parts.push(`Total recommendations: ${recs.recommendations.length} (${recs.criticalCount} critical, ${recs.highCount} high)`);
    parts.push(``);

    if (dominantCategory) {
      parts.push(`Dominant recommendation category: ${dominantCategory.category} (${dominantCategory.count} of ${recs.recommendations.length} items)`);
    }

    if (recs.improvementThemes.length > 0) {
      parts.push(`Recurring improvement themes: ${recs.improvementThemes.slice(0, 6).join(', ')}`);
    }

    if (architecture) {
      parts.push(`Architecture: ${architecture.dominantPattern} (${Math.round(architecture.patternConfidence * 100)}% confidence)`);
      parts.push(`Coupling assessment: ${architecture.couplingAssessment} | Hub nodes: ${architecture.hubCount} | Circular deps: ${architecture.circularDependencyCount}`);
    }

    if (top3.length > 0) {
      parts.push(``, `Highest-priority recommendations (for context, not to be repeated verbatim):`);
      for (const r of top3) {
        parts.push(`- [${r.priority}/${r.category}] ${r.title}: ${r.issueDescription}`);
      }
    }

    if (critical.length > 0 || high.length > 0) {
      const urgentAreas = [...new Set([...critical, ...high].map(r => r.affectedArea))].slice(0, 4);
      parts.push(`Affected areas with critical/high issues: ${urgentAreas.join(', ')}`);
    }

    parts.push(
      ``,
      `Do not reproduce the recommendation list. Reason about what the pattern means.`,
    );

    return parts.join('\n');
  }

  private _groupByCategory(recs: RecommendationAnalysis['recommendations']) {
    const counts: Record<string, number> = {};
    for (const r of recs) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }

  private _dominantCategory(groups: { category: string; count: number }[]) {
    return groups.sort((a, b) => b.count - a.count)[0] ?? null;
  }
}
