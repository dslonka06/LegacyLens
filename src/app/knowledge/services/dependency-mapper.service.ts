import { Injectable } from '@angular/core';
import { SourceFile, DependencyGraph, DependencyNode } from '../models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class DependencyMapperService {
  constructor(private readonly electron: ElectronService) {}

  async buildGraph(sourceFiles: SourceFile[]): Promise<DependencyGraph> {
    return this.electron.intelligenceBuildDependencyGraph(sourceFiles) as Promise<DependencyGraph>;
  }

  dependenciesOf(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const targetIds = new Set(graph.edges.filter(e => e.source === nodeId).map(e => e.target));
    return graph.nodes.filter(n => targetIds.has(n.id));
  }

  dependentsOf(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const sourceIds = new Set(graph.edges.filter(e => e.target === nodeId).map(e => e.source));
    return graph.nodes.filter(n => sourceIds.has(n.id));
  }

  mostConnected(graph: DependencyGraph, limit = 10): Array<{ node: DependencyNode; degree: number }> {
    const degree = new Map<string, number>();
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    return graph.nodes
      .map(node => ({ node, degree: degree.get(node.id) ?? 0 }))
      .filter(r => r.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, limit);
  }
}
