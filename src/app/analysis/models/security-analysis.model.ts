export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export type SecurityFindingCategory =
  | 'secrets-management'
  | 'authentication'
  | 'authorization'
  | 'input-validation'
  | 'sql-injection'
  | 'file-access'
  | 'external-calls'
  | 'configuration'
  | 'broad-access'
  | 'ai-finding';

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  category: SecurityFindingCategory;
  fileName: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  issueDescription: string;
  riskExplanation: string;
  remediation: string;
  affectedComponents: string[];
  affectedWorkflows: string[];
}

export interface SecurityHotspot {
  name: string;
  findingCount: number;
  riskLevel: SecuritySeverity;
  explanation: string;
}

export interface SecurityRelevantComponent {
  name: string;
  filePath: string;
  reason: string;
  role: string;
  patterns: string[];
}

export interface SecurityAnalysis {
  executiveSummary: string;
  summary: string;
  overallRisk: SecuritySeverity;
  securityMaturity: 'Low' | 'Medium' | 'High';
  maturityContext: string;
  riskContext: string;
  findings: SecurityFinding[];
  hotspots: SecurityHotspot[];
  relevantComponents: SecurityRelevantComponent[];
  recommendationThemes: string[];
  readinessAssessment: string;
  generatedAt: string;
}
