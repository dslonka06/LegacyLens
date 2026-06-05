import { Injectable } from '@angular/core';
import { DependencyGraph, DependencyNode } from '../models/knowledge.model';
import { ChangeImpactAnalysis } from '../models/data-flow.model';
import { WorkflowSummary } from '../models/data-flow.model';
import { DependencyExplorerService } from './dependency-explorer.service';

@Injectable({ providedIn: 'root' })
export class ChangeImpactService {

  constructor(private readonly explorer: DependencyExplorerService) {}

  analyze(
    nodeId: string,
    graph: DependencyGraph,
    workflows: WorkflowSummary[],
  ): ChangeImpactAnalysis {
    const target = graph.nodes.find(n => n.id === nodeId);
    if (!target) {
      return {
        target: nodeId,
        targetPath: nodeId,
        directImpacts: [],
        indirectImpacts: [],
        affectedWorkflows: [],
        riskLevel: 'Low',
        summary: 'File not found in dependency graph.',
      };
    }

    // Direct: files that import the target (inbound)
    const direct = this.explorer.incomingDependencies(nodeId, graph);
    const directNames = direct.map(n => n.name);

    // Indirect: files that import the direct dependents (one hop further)
    const indirectSet = new Set<string>();
    for (const dep of direct) {
      const secondHop = this.explorer.incomingDependencies(dep.id, graph);
      for (const n of secondHop) {
        if (n.id !== nodeId && !direct.find(d => d.id === n.id)) {
          indirectSet.add(n.name);
        }
      }
    }
    const indirectNames = Array.from(indirectSet).slice(0, 10);

    // Affected workflows: any workflow whose flow path contains this file's name
    const affectedWorkflows = workflows
      .filter(w => w.flowPath.some(step => step.toLowerCase() === target.name.toLowerCase()))
      .map(w => w.title);

    const riskLevel = this.computeRiskLevel(direct.length, indirectNames.length, affectedWorkflows.length);

    return {
      target: target.name,
      targetPath: target.path,
      directImpacts: directNames,
      indirectImpacts: indirectNames,
      affectedWorkflows,
      riskLevel,
      summary: this.buildSummary(target.name, direct.length, indirectNames.length, affectedWorkflows, riskLevel),
    };
  }

  private computeRiskLevel(
    directCount: number,
    indirectCount: number,
    workflowCount: number,
  ): 'Low' | 'Medium' | 'High' {
    const score = directCount * 2 + indirectCount + workflowCount * 3;
    if (score >= 10) return 'High';
    if (score >= 4)  return 'Medium';
    return 'Low';
  }

  private buildSummary(
    name: string,
    direct: number,
    indirect: number,
    workflows: string[],
    risk: string,
  ): string {
    const parts: string[] = [];

    if (direct === 0) {
      parts.push(`${name} has no detected inbound dependencies. Changes here are unlikely to affect other files.`);
    } else {
      parts.push(`Changes to ${name} directly affect ${direct} file${direct === 1 ? '' : 's'}.`);
    }

    if (indirect > 0) {
      parts.push(`An additional ${indirect} file${indirect === 1 ? '' : 's'} may be indirectly affected.`);
    }

    if (workflows.length) {
      parts.push(`This file participates in ${workflows.length} workflow${workflows.length === 1 ? '' : 's'}: ${workflows.slice(0, 2).join(', ')}${workflows.length > 2 ? '…' : ''}.`);
    }

    parts.push(`Overall risk level: ${risk}.`);

    return parts.join(' ');
  }
}
