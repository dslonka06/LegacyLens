import { Injectable } from '@angular/core';
import { RepositoryKnowledge } from '../models/knowledge.model';
import { DependencyExplorerService } from './dependency-explorer.service';

export type InsightSeverity = 'high' | 'medium' | 'low' | 'info';

export interface RepositoryInsight {
  title: string;
  description: string;
  severity: InsightSeverity;
  category: 'broad-scope' | 'high-coupling' | 'hub' | 'orphan' | 'stat';
  affectedFiles?: string[];
}

// Thresholds — deliberately conservative for pattern-only analysis
const HIGH_INBOUND_THRESHOLD = 8;
const HIGH_OUTBOUND_THRESHOLD = 10;
const HUB_DEGREE_MULTIPLIER = 2.5;

@Injectable({ providedIn: 'root' })
export class RepositoryInsightsService {

  constructor(private readonly explorer: DependencyExplorerService) {}

  // Returns only insights that reference a specific node by name or path.
  // Delegates to analyze() and filters — no separate detection logic.
  insightsForNode(nodeId: string, knowledge: RepositoryKnowledge): RepositoryInsight[] {
    const node = knowledge.dependencyGraph?.nodes.find(n => n.id === nodeId);
    if (!node) return [];

    const all = this.analyze(knowledge);
    return all.filter(insight =>
      insight.affectedFiles?.some(f =>
        f === node.name || f === node.path || node.name.includes(f) || f.includes(node.name)
      )
    );
  }

  analyze(knowledge: RepositoryKnowledge): RepositoryInsight[] {
    const insights: RepositoryInsight[] = [];
    const graph = knowledge.dependencyGraph;

    if (!graph || graph.nodes.length === 0) {
      return [{
        title: 'No dependency data available',
        description: 'Upload source files to generate dependency insights.',
        severity: 'info',
        category: 'stat',
      }];
    }

    // ── High inbound coupling — widely referenced files ───────────────────
    const rankings = this.explorer.rankByConnectivity(graph, graph.nodes.length);
    const highInbound = rankings.filter(r => r.inbound >= HIGH_INBOUND_THRESHOLD);
    for (const r of highInbound.slice(0, 3)) {
      insights.push({
        title: `Widely Referenced: ${r.node.name}`,
        description: `Used by ${r.inbound} other files. Changes to this file have a broad blast radius — verify all consumers before modifying.`,
        severity: r.inbound >= HIGH_INBOUND_THRESHOLD * 2 ? 'high' : 'medium',
        category: 'high-coupling',
        affectedFiles: [r.node.name],
      });
    }

    // ── Broad scope — high outbound (depends on many others) ─────────────
    const broadScope = rankings.filter(r => r.outbound >= HIGH_OUTBOUND_THRESHOLD);
    for (const r of broadScope.slice(0, 3)) {
      insights.push({
        title: `Broad Scope: ${r.node.name}`,
        description: `Depends on ${r.outbound} other files. This component spans many concerns — a candidate for decomposition if responsibilities are unrelated.`,
        severity: 'medium',
        category: 'broad-scope',
        affectedFiles: [r.node.name],
      });
    }

    // ── Dependency hubs — significantly above-average connectivity ────────
    const hubs = this.explorer.dependencyHubs(graph, HUB_DEGREE_MULTIPLIER);
    if (hubs.length > 0) {
      const names = hubs.slice(0, 5).map(h => h.node.name);
      insights.push({
        title: `System Hub${hubs.length > 1 ? 's' : ''}: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}`,
        description: `${hubs.length === 1 ? 'This component sits' : 'These components sit'} at the centre of the dependency graph with significantly more connections than average. Changes here have the widest impact.`,
        severity: 'medium',
        category: 'hub',
        affectedFiles: names,
      });
    }

    // ── Orphaned files ────────────────────────────────────────────────────
    const orphans = this.explorer.orphanedFiles(graph);
    if (orphans.length > 0) {
      insights.push({
        title: `${orphans.length} Orphaned File${orphans.length > 1 ? 's' : ''} Found`,
        description: `${orphans.length} file${orphans.length > 1 ? 's have' : ' has'} no detected import or export relationships. May be unused, standalone utilities, or entry points.`,
        severity: 'low',
        category: 'orphan',
        affectedFiles: orphans.slice(0, 5).map(n => n.name),
      });
    }

    // ── Summary stat ─────────────────────────────────────────────────────
    const avg = this.explorer.averageConnectivity(graph);
    insights.push({
      title: 'Average Connectivity',
      description: `Each file has an average of ${avg} dependency relationships. Values above 5 suggest tight coupling.`,
      severity: avg > 5 ? 'medium' : 'info',
      category: 'stat',
    });

    return insights;
  }
}
