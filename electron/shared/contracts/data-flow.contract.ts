/**
 * Data flow and workflow types — outputs of the Architecture Engine.
 * Shared between Angular renderer and Electron main process.
 */

export interface DataFlowNode {
  id: string;
  name: string;
  type: 'entry' | 'processor' | 'repository' | 'database' | 'external' | 'unknown';
  path?: string;
}

export interface DataFlowConnection {
  sourceId: string;
  targetId: string;
  relationshipType: string;
}

export interface DataFlow {
  name: string;
  description: string;
  nodes: DataFlowNode[];
  connections: DataFlowConnection[];
  confidence: number;
}

export type WorkflowCategory =
  | 'request-handling'
  | 'data-access'
  | 'event-processing'
  | 'component-service'
  | 'queue-processing'
  | 'generic';

export interface WorkflowSummary {
  title: string;
  description: string;
  steps: string[];
  flowPath: string[];
  confidence: number;
  category: WorkflowCategory;
}

export interface BehaviorInsights {
  entryPoints: string[];
  mostReferencedServices: string[];
  frequentlyUsedRepositories: string[];
  workflowBottlenecks: string[];
}

export interface ChangeImpactAnalysis {
  target: string;
  targetPath: string;
  directImpacts: string[];
  indirectImpacts: string[];
  affectedWorkflows: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
}
