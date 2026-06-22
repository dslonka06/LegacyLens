// Types from: @app/knowledge/models/knowledge.model
export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relationshipType: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface FileRanking {
  node: DependencyNode;
  inbound: number;
  outbound: number;
  total: number;
}

export interface DependencyHub {
  node: DependencyNode;
  degree: number;
  isHub: boolean;   // true when degree significantly exceeds average
}

export class DependencyExplorerEngine {

  // ── Direct queries ──────────────────────────────────────────────────────

  incomingDependencies(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const sourceIds = new Set(
      graph.edges.filter(e => e.target === nodeId).map(e => e.source)
    );
    return graph.nodes.filter(n => sourceIds.has(n.id));
  }

  outgoingDependencies(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const targetIds = new Set(
      graph.edges.filter(e => e.source === nodeId).map(e => e.target)
    );
    return graph.nodes.filter(n => targetIds.has(n.id));
  }

  // ── Rankings ────────────────────────────────────────────────────────────

  rankByConnectivity(graph: DependencyGraph, limit = 10): FileRanking[] {
    const inbound = new Map<string, number>();
    const outbound = new Map<string, number>();

    for (const e of graph.edges) {
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
      outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
    }

    return graph.nodes
      .map(node => ({
        node,
        inbound:  inbound.get(node.id)  ?? 0,
        outbound: outbound.get(node.id) ?? 0,
        total:   (inbound.get(node.id)  ?? 0) + (outbound.get(node.id) ?? 0),
      }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  // ── Structural analysis ─────────────────────────────────────────────────

  // Orphaned files: nodes with zero edges in either direction
  orphanedFiles(graph: DependencyGraph): DependencyNode[] {
    const connected = new Set<string>();
    for (const e of graph.edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    return graph.nodes.filter(n => !connected.has(n.id) && n.type !== 'table' && n.type !== 'namespace');
  }

  // Dependency hubs: nodes whose total degree is notably above average
  dependencyHubs(graph: DependencyGraph, threshold = 2.0): DependencyHub[] {
    const rankings = this.rankByConnectivity(graph, graph.nodes.length);
    if (rankings.length === 0) return [];

    const avg = rankings.reduce((s, r) => s + r.total, 0) / rankings.length;
    const cutoff = avg * threshold;

    return rankings
      .filter(r => r.total >= cutoff)
      .map(r => ({ node: r.node, degree: r.total, isHub: true }));
  }

  // ── Summary stats ───────────────────────────────────────────────────────

  averageConnectivity(graph: DependencyGraph): number {
    if (graph.nodes.length === 0) return 0;
    const total = graph.edges.length * 2; // each edge contributes to 2 nodes
    return Math.round((total / graph.nodes.length) * 10) / 10;
  }
}
