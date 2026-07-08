import { Injectable } from '@angular/core';
import { DataFlow, WorkflowSummary } from '../models/data-flow.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class WorkflowExplorerService {
  constructor(private readonly electron: ElectronService) {}

  async buildSummaries(flows: DataFlow[]): Promise<WorkflowSummary[]> {
    return this.electron.intelligenceExploreWorkflows(flows) as Promise<WorkflowSummary[]>;
  }

  summariesForNode(nodeId: string, flows: DataFlow[]): WorkflowSummary[] {
    // Pure filter — no engine needed, operates on already-built flows
    return flows
      .filter(f => f.nodes.some(n => n.id === nodeId || n.name === nodeId))
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.description ?? '',
        flowPath: f.nodes.map(n => n.name ?? n.id),
        steps: [],
        category: f.category ?? 'unknown',
        complexity: f.complexity ?? 'low',
      }));
  }
}
