import { Injectable } from '@angular/core';
import { DependencyGraph, DependencyNode } from '../models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

export interface FileRanking {
  node: DependencyNode;
  inbound: number;
  outbound: number;
  total: number;
}

export interface DependencyHub {
  node: DependencyNode;
  degree: number;
  isHub: boolean;
}

@Injectable({ providedIn: 'root' })
export class DependencyExplorerService {
  constructor(private readonly electron: ElectronService) {}

  incomingDependencies(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const sourceIds = new Set(graph.edges.filter(e => e.target === nodeId).map(e => e.source));
    return graph.nodes.filter(n => sourceIds.has(n.id));
  }

  outgoingDependencies(nodeId: string, graph: DependencyGraph): DependencyNode[] {
    const targetIds = new Set(graph.edges.filter(e => e.source === nodeId).map(e => e.target));
    return graph.nodes.filter(n => targetIds.has(n.id));
  }

  async rankByConnectivity(graph: DependencyGraph, limit = 10): Promise<FileRanking[]> {
    const result = await this.electron.intelligenceExploreDependencies(graph);
    return ((result?.ranked ?? []) as FileRanking[]).slice(0, limit);
  }

  async orphanedFiles(graph: DependencyGraph): Promise<DependencyNode[]> {
    const result = await this.electron.intelligenceExploreDependencies(graph);
    return (result?.orphans ?? []) as DependencyNode[];
  }

  async dependencyHubs(graph: DependencyGraph, threshold = 2.0): Promise<DependencyHub[]> {
    const result = await this.electron.intelligenceExploreDependencies(graph);
    return (result?.hubs ?? []) as DependencyHub[];
  }

  async averageConnectivity(graph: DependencyGraph): Promise<number> {
    if (graph.nodes.length === 0) return 0;
    const total = graph.edges.length * 2;
    return Math.round((total / graph.nodes.length) * 10) / 10;
  }
}
