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
  | 'cryptography'
  | 'ai-finding';

export type SecurityVerificationDomain =
  | 'secrets'
  | 'input-validation'
  | 'authentication'
  | 'authorization'
  | 'data-access'
  | 'logging'
  | 'error-handling'
  | 'cryptography';

export type VerificationStatus = 'pass' | 'warn' | 'fail';

export interface SecurityVerificationCheck {
  domain: SecurityVerificationDomain;
  status: VerificationStatus;
  summary: string;
  detail?: string;
}

// ── Evidence report types — populated by the derive stage ────────────────────
// Internal use only — not rendered directly.

export interface CandidateFinding {
  file: string;
  pattern: string;
  patternDescription: string;
  snippet: string;
  lineStart: number;
  lineEnd: number;
}

export interface SecurityEvidenceReport {
  scope: 'file' | 'folder' | 'repository';
  fileCount: number;
  languages: string[];
  candidates: CandidateFinding[];
  domainEvidence: {
    secrets: {
      envVarRefs: number;
      secretsManagerRefs: number;
      hardcodedHits: number;
      examples: CandidateFinding[];
    };
    inputValidation: {
      frameworkDetected: string | null;
      validationAttributes: number;
      guardClauseCount: number;
      unvalidatedEntryPoints: number;
    };
    authentication: {
      frameworkDetected: string | null;
      protectedSurfaces: number;
      unprotectedHttpVerbs: number;
      middlewareFound: boolean;
    };
    authorization: {
      roleScopedCount: number;
      policyScopedCount: number;
      presenceOnlyCount: number;
      permissionCheckCount: number;
    };
    dataAccess: {
      ormDetected: string | null;
      parameterisedCount: number;
      concatenatedCount: number;
      storedProcedureCount: number;
    };
    logging: {
      frameworkDetected: string | null;
      structuredLoggingUsed: boolean;
      sensitiveAdjacentCount: number;
      rawConsoleLogCount: number;
      examples: CandidateFinding[];
    };
    errorHandling: {
      tryCatchCount: number;
      emptyCatchCount: number;
      globalHandlerFound: boolean;
      stackExposureCount: number;
    };
    cryptography: {
      strongAlgorithms: string[];
      weakAlgorithms: string[];
      hardcodedIvOrKey: number;
      examples: CandidateFinding[];
    };
  };
}

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

export interface SecurityNextStep {
  priority: 'immediate' | 'high' | 'recommended';
  title: string;
  detail: string;
  category: string;
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
  nextSteps?: SecurityNextStep[];
  /** LLM-graded domain checks — populated by generate tier. */
  verificationChecks?: SecurityVerificationCheck[];
  /** Evidence gathered by SecurityEvidenceEngine — staging field for LLM prompt. */
  evidence?: SecurityEvidenceReport;
}
