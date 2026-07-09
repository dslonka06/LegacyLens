import { Injectable } from '@angular/core';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { RepositoryStructure } from '@app/knowledge/models/repository.model';
import { DataFlow, BehaviorInsights } from '../models/data-flow.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class DataFlowDiscoveryService {
  constructor(private readonly electron: ElectronService) {}

  async discoverWorkflows(knowledge: RepositoryKnowledge, structure?: RepositoryStructure): Promise<DataFlow[]> {
    return this.electron.intelligenceDiscoverDataFlows(knowledge, structure ?? null) as Promise<DataFlow[]>;
  }

  extractBehaviorInsights(knowledge: RepositoryKnowledge): BehaviorInsights {
    const graph = knowledge.dependencyGraph;
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;
    return {
      entryPoints: [],
      mostReferencedServices: [],
      frequentlyUsedRepositories: [],
      workflowBottlenecks: [`${nodeCount} components with ${edgeCount} dependency edges.`],
    };
  }
}
