import { Injectable } from '@angular/core';
import { DependencyGraph, DependencyNode, RepositoryKnowledge } from '../models/knowledge.model';
import { DataFlow, WorkflowSummary } from '../models/data-flow.model';
import { NodeIntelligence } from '../models/navigation.model';
import { DependencyExplorerService } from './dependency-explorer.service';
import { ChangeImpactService } from './change-impact.service';
import { RepositoryInsightsService } from './repository-insights.service';
import { WorkflowExplorerService } from './workflow-explorer.service';

@Injectable({ providedIn: 'root' })
export class NodeIntelligenceFacade {

  constructor(
    private readonly explorer:   DependencyExplorerService,
    private readonly impact:     ChangeImpactService,
    private readonly insights:   RepositoryInsightsService,
    private readonly workflows:  WorkflowExplorerService,
  ) {}

  // Synchronous — all underlying services are pure functions.
  // Returns immediately; no loading state required at this level.
  build(
    node:      DependencyNode,
    knowledge: RepositoryKnowledge,
    flows:     DataFlow[],
    summaries: WorkflowSummary[],
  ): NodeIntelligence {
    const graph = knowledge.dependencyGraph ?? this.emptyGraph();

    const incoming = this.explorer.incomingDependencies(node.id, graph);
    const outgoing = this.explorer.outgoingDependencies(node.id, graph);
    const changeImpact = this.impact.analyze(node.id, graph, summaries);
    const nodeInsights = this.insights.insightsForNode(node.id, knowledge);
    const touchingWorkflows = this.workflows.summariesForNode(node.id, flows);
    const connectivityRank = this.resolveRank(node.id, graph);

    return {
      node,
      incoming,
      outgoing,
      touchingWorkflows,
      changeImpact,
      insights: nodeInsights,
      connectivityRank,
    };
  }

  private resolveRank(nodeId: string, graph: DependencyGraph): number | null {
    if (graph.nodes.length === 0) return null;
    const rankings = this.explorer.rankByConnectivity(graph, graph.nodes.length);
    const index = rankings.findIndex(r => r.node.id === nodeId);
    return index === -1 ? null : index + 1; // 1-based rank
  }

  private emptyGraph(): DependencyGraph {
    return { nodes: [], edges: [] };
  }
}
