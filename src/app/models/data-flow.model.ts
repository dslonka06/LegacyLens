// Stage 7 — Behavior & Data Flow Intelligence models
// These answer "What happens when this runs?" not "What files exist?"

export interface DataFlowNode {
  id: string;
  name: string;
  // Role in the workflow: entry, processor, repository, database, external
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

export interface WorkflowSummary {
  title: string;
  description: string;
  // Ordered list of steps in plain English
  steps: string[];
  // Ordered display path, e.g. ["OrderController", "OrderService", "OrderRepository"]
  flowPath: string[];
  confidence: number;
  // Category used for display grouping
  category: WorkflowCategory;
}

export type WorkflowCategory =
  | 'request-handling'
  | 'data-access'
  | 'event-processing'
  | 'component-service'
  | 'queue-processing'
  | 'generic';

export interface ChangeImpactAnalysis {
  target: string;
  targetPath: string;
  directImpacts: string[];
  indirectImpacts: string[];
  affectedWorkflows: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
}

export interface BehaviorInsight {
  title: string;
  description: string;
  items: string[];
  category: 'entry-points' | 'services' | 'repositories' | 'bottlenecks';
}

export interface BehaviorInsights {
  entryPoints: string[];
  mostReferencedServices: string[];
  frequentlyUsedRepositories: string[];
  workflowBottlenecks: string[];
}
