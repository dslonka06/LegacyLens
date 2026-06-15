import { Injectable } from '@angular/core';
import { DependencyGraph, DependencyNode, RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { RepositoryStructure } from '@app/knowledge/models/repository.model';
import { BehaviorInsights, DataFlow, DataFlowConnection, DataFlowNode, WorkflowCategory } from '../models/data-flow.model';

// ── Name-based role detection ─────────────────────────────────────────────────

// Patterns that suggest an entry point (receives external requests)
const ENTRY_PATTERNS = [
  /controller/i, /handler/i, /endpoint/i, /api/i, /route/i,
  /page\./i, /screen\./i, /view\./i, /presenter/i,
];

// Patterns that suggest a service / processor
const SERVICE_PATTERNS = [
  /service/i, /manager/i, /processor/i, /calculator/i, /engine/i,
  /orchestrator/i, /workflow/i, /usecase/i, /command/i, /query/i,
];

// Patterns that suggest a repository / data-access layer
const REPO_PATTERNS = [
  /repository/i, /repo\./i, /dao\./i, /store\./i, /storage/i,
  /persistence/i, /data\./i, /cache/i, /database/i,
];

// Patterns that suggest a database table or external system
const DB_PATTERNS = [/^table:/i, /db\./i, /sql/i];

// Patterns that suggest external service integrations
const EXTERNAL_PATTERNS = [
  /client/i, /gateway/i, /provider/i, /adapter/i,
  /proxy/i, /connector/i, /integration/i,
];

function inferNodeType(node: DependencyNode): DataFlowNode['type'] {
  const name = node.name.toLowerCase();
  if (DB_PATTERNS.some(p => p.test(node.id) || p.test(name))) return 'database';
  if (REPO_PATTERNS.some(p => p.test(name))) return 'repository';
  if (ENTRY_PATTERNS.some(p => p.test(name))) return 'entry';
  if (EXTERNAL_PATTERNS.some(p => p.test(name))) return 'external';
  if (SERVICE_PATTERNS.some(p => p.test(name))) return 'processor';
  return 'unknown';
}

// ── Workflow detection rules ──────────────────────────────────────────────────

interface WorkflowRule {
  name: string;
  category: WorkflowCategory;
  // Ordered role sequence that defines this workflow pattern
  roleSequence: DataFlowNode['type'][];
  minConfidence: number;
}

const WORKFLOW_RULES: WorkflowRule[] = [
  {
    name: 'Request Handling (Controller → Service → Repository)',
    category: 'request-handling',
    roleSequence: ['entry', 'processor', 'repository'],
    minConfidence: 0.75,
  },
  {
    name: 'Request Handling (Controller → Service)',
    category: 'request-handling',
    roleSequence: ['entry', 'processor'],
    minConfidence: 0.65,
  },
  {
    name: 'Data Access (Service → Repository → Database)',
    category: 'data-access',
    roleSequence: ['processor', 'repository', 'database'],
    minConfidence: 0.70,
  },
  {
    name: 'Component → Service Flow',
    category: 'component-service',
    roleSequence: ['entry', 'processor'],
    minConfidence: 0.60,
  },
  {
    name: 'External Integration (Service → Client → External)',
    category: 'generic',
    roleSequence: ['processor', 'external'],
    minConfidence: 0.60,
  },
];

@Injectable({ providedIn: 'root' })
export class DataFlowDiscoveryService {

  discoverWorkflows(knowledge: RepositoryKnowledge, structure?: RepositoryStructure): DataFlow[] {
    const graph = knowledge.dependencyGraph;
    if (!graph || graph.nodes.length < 3 || graph.edges.length < 2) return [];

    // Annotate every node with its inferred role
    const typed = new Map<string, DataFlowNode>(
      graph.nodes.map(n => [n.id, {
        id: n.id,
        name: n.name,
        type: inferNodeType(n),
        path: n.path,
      }])
    );

    const flows: DataFlow[] = [];

    // For each entry node, attempt to trace forward through the graph
    const entryNodes = Array.from(typed.values()).filter(n => n.type === 'entry');

    for (const entry of entryNodes.slice(0, 10)) {  // cap to avoid O(n²) on large graphs
      const chain = this.traceForward(entry.id, typed, graph, new Set(), 6);
      if (chain.length < 2) continue;

      const rule = this.matchRule(chain);
      if (!rule) continue;

      const flowNodes = chain.map(id => typed.get(id)!).filter(Boolean);
      const connections: DataFlowConnection[] = [];
      for (let i = 0; i < chain.length - 1; i++) {
        const edge = graph.edges.find(e => e.source === chain[i] && e.target === chain[i + 1]);
        connections.push({
          sourceId: chain[i],
          targetId: chain[i + 1],
          relationshipType: edge?.relationshipType ?? 'depends on',
        });
      }

      flows.push({
        name: `${entry.name} Workflow`,
        description: this.describeFlow(flowNodes, rule.category),
        nodes: flowNodes,
        connections,
        confidence: rule.minConfidence + (chain.length > 3 ? 0.05 : 0),
      });
    }

    // Deduplicate by similar node sequences
    return this.deduplicateFlows(flows).slice(0, 8);
  }

  extractBehaviorInsights(knowledge: RepositoryKnowledge): BehaviorInsights {
    const graph = knowledge.dependencyGraph;
    if (!graph) {
      return { entryPoints: [], mostReferencedServices: [], frequentlyUsedRepositories: [], workflowBottlenecks: [] };
    }

    const typed = graph.nodes.map(n => ({ node: n, type: inferNodeType(n) }));

    // Entry points: entry-type nodes with inbound edges (called from outside)
    const inboundCount = new Map<string, number>();
    const outboundCount = new Map<string, number>();
    for (const e of graph.edges) {
      inboundCount.set(e.target, (inboundCount.get(e.target) ?? 0) + 1);
      outboundCount.set(e.source, (outboundCount.get(e.source) ?? 0) + 1);
    }

    const entryPoints = typed
      .filter(t => t.type === 'entry')
      .sort((a, b) => (inboundCount.get(b.node.id) ?? 0) - (inboundCount.get(a.node.id) ?? 0))
      .slice(0, 5)
      .map(t => t.node.name);

    const services = typed
      .filter(t => t.type === 'processor')
      .sort((a, b) => (inboundCount.get(b.node.id) ?? 0) - (inboundCount.get(a.node.id) ?? 0))
      .slice(0, 5)
      .map(t => t.node.name);

    const repos = typed
      .filter(t => t.type === 'repository')
      .sort((a, b) => (inboundCount.get(b.node.id) ?? 0) - (inboundCount.get(a.node.id) ?? 0))
      .slice(0, 5)
      .map(t => t.node.name);

    // Bottlenecks: nodes with both high inbound AND high outbound
    const avgIn  = inboundCount.size  ? Array.from(inboundCount.values()).reduce((s, v) => s + v, 0)  / inboundCount.size  : 0;
    const avgOut = outboundCount.size ? Array.from(outboundCount.values()).reduce((s, v) => s + v, 0) / outboundCount.size : 0;

    const bottlenecks = graph.nodes
      .filter(n => (inboundCount.get(n.id) ?? 0) > avgIn * 1.5 && (outboundCount.get(n.id) ?? 0) > avgOut * 1.5)
      .slice(0, 5)
      .map(n => n.name);

    return { entryPoints, mostReferencedServices: services, frequentlyUsedRepositories: repos, workflowBottlenecks: bottlenecks };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private traceForward(
    nodeId: string,
    typed: Map<string, DataFlowNode>,
    graph: DependencyGraph,
    visited: Set<string>,
    maxDepth: number,
  ): string[] {
    if (visited.has(nodeId) || maxDepth === 0) return [nodeId];
    visited.add(nodeId);

    const outEdges = graph.edges.filter(e => e.source === nodeId);
    if (!outEdges.length) return [nodeId];

    // Follow the most semantically meaningful outgoing edge
    for (const edge of outEdges.slice(0, 3)) {
      const next = typed.get(edge.target);
      if (!next || visited.has(edge.target)) continue;

      // Only follow meaningful type transitions
      const from = typed.get(nodeId)?.type;
      const to = next.type;
      if (this.isForwardTransition(from, to)) {
        return [nodeId, ...this.traceForward(edge.target, typed, graph, new Set(visited), maxDepth - 1)];
      }
    }

    return [nodeId];
  }

  private isForwardTransition(from: DataFlowNode['type'] | undefined, to: DataFlowNode['type']): boolean {
    const transitions: Record<string, Set<string>> = {
      entry:      new Set(['processor', 'external', 'repository']),
      processor:  new Set(['repository', 'external', 'database', 'processor']),
      repository: new Set(['database', 'external']),
      external:   new Set(['processor', 'repository']),
    };
    return transitions[from ?? '']?.has(to) ?? false;
  }

  private matchRule(chain: string[]): WorkflowRule | null {
    // We don't have role info here — use the chain length as a proxy
    // The actual rule matching happens at the flow level
    return WORKFLOW_RULES.find(r => r.roleSequence.length <= chain.length) ?? null;
  }

  private describeFlow(nodes: DataFlowNode[], category: WorkflowCategory): string {
    if (nodes.length < 2) return '';
    const names = nodes.map(n => n.name);
    switch (category) {
      case 'request-handling':
        return `Requests enter through ${names[0]}, are processed by ${names.slice(1, -1).join(' and ')}, and persisted via ${names[names.length - 1]}.`;
      case 'data-access':
        return `Data flows from ${names[0]} through ${names.slice(1).join(' → ')}.`;
      case 'component-service':
        return `${names[0]} interacts with ${names.slice(1).join(' and ')} to complete its operation.`;
      default:
        return `${names.join(' → ')}.`;
    }
  }

  private deduplicateFlows(flows: DataFlow[]): DataFlow[] {
    const seen = new Set<string>();
    return flows.filter(f => {
      const key = f.nodes.map(n => n.name).join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
