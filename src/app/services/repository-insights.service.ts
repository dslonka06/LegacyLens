import { Injectable } from '@angular/core';
import { RepositoryKnowledge } from '../models/knowledge.model';
import { DependencyExplorerService } from './dependency-explorer.service';

export type InsightSeverity = 'high' | 'medium' | 'low' | 'info';

export interface RepositoryInsight {
  title: string;
  description: string;
  severity: InsightSeverity;
  category: 'bottleneck' | 'god-class' | 'hotspot' | 'orphan' | 'stat';
  affectedFiles?: string[];
}

// Thresholds — deliberately conservative for pattern-only analysis
const GOD_CLASS_INBOUND_THRESHOLD = 8;
const BOTTLENECK_OUTBOUND_THRESHOLD = 10;
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

    // ── God classes (high inbound) ────────────────────────────────────────
    const rankings = this.explorer.rankByConnectivity(graph, graph.nodes.length);
    const godCandidates = rankings.filter(r => r.inbound >= GOD_CLASS_INBOUND_THRESHOLD);
    for (const r of godCandidates.slice(0, 3)) {
      insights.push({
        title: `Potential God Class: ${r.node.name}`,
        description: `${r.node.name} is imported by ${r.inbound} other files. High inbound coupling makes this file a change risk.`,
        severity: r.inbound >= GOD_CLASS_INBOUND_THRESHOLD * 2 ? 'high' : 'medium',
        category: 'god-class',
        affectedFiles: [r.node.name],
      });
    }

    // ── Bottlenecks (high outbound) ───────────────────────────────────────
    const bottlenecks = rankings.filter(r => r.outbound >= BOTTLENECK_OUTBOUND_THRESHOLD);
    for (const r of bottlenecks.slice(0, 3)) {
      insights.push({
        title: `Potential Bottleneck: ${r.node.name}`,
        description: `${r.node.name} depends on ${r.outbound} other files. High outbound coupling suggests broad responsibilities.`,
        severity: 'medium',
        category: 'bottleneck',
        affectedFiles: [r.node.name],
      });
    }

    // ── Dependency hotspots (hubs) ────────────────────────────────────────
    const hubs = this.explorer.dependencyHubs(graph, HUB_DEGREE_MULTIPLIER);
    if (hubs.length > 0) {
      const names = hubs.slice(0, 5).map(h => h.node.name);
      insights.push({
        title: `Dependency Hotspot${hubs.length > 1 ? 's' : ''} Detected`,
        description: `${names.join(', ')} ${hubs.length === 1 ? 'has' : 'have'} significantly more connections than average. Changes here ripple widely.`,
        severity: 'medium',
        category: 'hotspot',
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
