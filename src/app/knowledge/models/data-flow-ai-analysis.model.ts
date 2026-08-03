export interface EnrichedConnection {
  sourceId: string;
  targetId: string;
  verb: string;
}

export interface WorkflowRiskProfile {
  workflowName: string;
  entryPoint: string;
  stepCount: number;
  bottleneckNodes: string[];
  failureRisk: 'Low' | 'Moderate' | 'High';
  narrative?: string;
  enrichedConnections?: EnrichedConnection[];
}

export interface DataFlowAIAnalysis {
  workflowCount: number;
  primaryWorkflows: WorkflowRiskProfile[];
  entryPoints: string[];
  bottlenecks: string[];
  externalDependencies: string[];
  mostReferenced: string[];
  dataAccessNodes: string[];
  generatedAt: string;
  /** Mermaid flowchart LR syntax for the data flow workflow diagram. */
  dataFlowDiagram?: string;
}
