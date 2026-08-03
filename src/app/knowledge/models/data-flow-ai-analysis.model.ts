export interface EnrichedConnection {
  sourceId: string;
  targetId: string;
  verb: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface WorkflowRiskProfile {
  workflowName: string;
  entryPoint: string;
  stepCount: number;
  bottleneckNodes: string[];
  failureRisk: 'Low' | 'Moderate' | 'High';
  narrative?: string;
  flowPath: string[];
  steps: WorkflowStep[];
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
  /** Per-file role breakdown with narrative, produced by FileRoleNarrativeEngine. Folder + repo only. */
  fileRoles?: Array<{
    name: string;
    path: string;
    shortPath: string;
    fileRole: string;
    sources: string[];
    sinks: string[];
    narrative: string;
  }> | null;
}
