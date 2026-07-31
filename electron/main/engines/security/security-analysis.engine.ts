// Types from: @app/analysis/models/security-analysis.model
// Types from: @app/analysis/models/analysis-session.model
// Types from: @app/knowledge/models/knowledge.model
import { DependencyExplorerEngine } from '../analysis/dependency-explorer.engine';

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
  filePath?: string;
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

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  path?: string;
}

export interface RepositoryKnowledge {
  sourceFiles?: { path: string; content: string }[];
  dependencyGraph?: {
    nodes: DependencyNode[];
    edges: { source: string; target: string }[];
  };
}

export interface AnalysisSession {
  fileName: string;
  sourceCode: string;
  analysis: { risks?: { title?: string; description: string; severity: string }[] };
  aiAnalysis?: {
    risks?: { title: string; description: string; severity: string }[];
    summary?: string;
  };
  workspaceContext?: any;
}

// Patterns that make a file security-relevant (for the "Security-Relevant Components" section)
const SENSITIVE_NAME_PATTERNS = [
  'auth', 'oauth', 'jwt', 'token', 'secret', 'password', 'credential',
  'permission', 'role', 'claim', 'identity', 'session', 'encrypt',
  'decrypt', 'hash', 'salt', 'security', 'privilege',
];

// Patterns that, combined with other signals, generate actual findings
const SECRET_PATTERNS = [
  /password\s*=\s*["'][^"']{4,}/i,
  /apikey\s*=\s*["'][^"']{8,}/i,
  /api_key\s*=\s*["'][^"']{8,}/i,
  /connectionstring\s*=\s*["'][^"']{12,}/i,
  /server\s*=\s*\w+;.*password\s*=/i,
  /secret\s*=\s*["'][^"']{4,}/i,
  /privatekey\s*=\s*["'][^"']{8,}/i,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
  /eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_+/=]*/,  // raw JWT
];

const SQL_INJECTION_PATTERNS = [
  /\+\s*["']?\s*\w*\s*\+/,  // string concatenation in query context
  /string\.format.*select/i,
  /execute\s*\(.*\+/i,
  /sql\s*=.*\+\s*\w/i,
  /query\s*=.*\+\s*\w/i,
  /"select.*"\s*\+/i,
  /"insert.*"\s*\+/i,
  /"update.*"\s*\+/i,
  /"delete.*"\s*\+/i,
];

const HIGH_COUPLING_THRESHOLD = 10; // inbound deps to flag as broad-access security concern

export class SecurityAnalysisEngine {

  constructor(private readonly explorer: DependencyExplorerEngine) {}

  // ── File-scope security analysis ──────────────────────────────────────────

  analyzeFile(session: AnalysisSession): SecurityAnalysis {
    const findings: SecurityFinding[] = [];
    const relevant: SecurityRelevantComponent[] = [];
    const now = new Date().toISOString();

    // Pattern-based findings on the single file
    this.detectFileFindings(session.fileName, session.sourceCode, findings);

    // AI-sourced findings from risk list
    const ai = session.aiAnalysis;
    if (ai?.risks) {
      for (const risk of ai.risks) {
        if (this.isSecurityRisk(risk.title + ' ' + risk.description)) {
          findings.push({
            id: `ai-${findings.length}`,
            title: risk.title,
            severity: this.mapAiSeverity(risk.severity),
            category: 'ai-finding',
            fileName: session.fileName,
            issueDescription: risk.description,
            riskExplanation: 'This concern was identified by AI analysis as a security-relevant risk.',
            remediation: 'Review this area carefully. Refer to the AI recommendation for context.',
            affectedComponents: [session.fileName],
            affectedWorkflows: [],
          });
        }
      }
    }

    // Relevant component for the file itself if name matches sensitive patterns
    if (this.isSensitiveName(session.fileName)) {
      relevant.push({
        name: session.fileName,
        filePath: session.fileName,
        reason: 'File name suggests security-sensitive functionality.',
        role: this.deriveComponentRole(session.fileName),
        patterns: this.matchedPatterns(session.fileName),
      });
    }

    return this.buildAnalysis(findings, relevant, [], now);
  }

  // ── Folder/Repository-scope security analysis ─────────────────────────────

  analyzeKnowledge(knowledge: RepositoryKnowledge, session: AnalysisSession | null): SecurityAnalysis {
    const findings: SecurityFinding[] = [];
    const relevant: SecurityRelevantComponent[] = [];
    const hotspots: SecurityHotspot[] = [];
    const now = new Date().toISOString();

    const sourceFiles = knowledge.sourceFiles ?? [];
    const graph = knowledge.dependencyGraph;

    // ── Per-file analysis ────────────────────────────────────────────────────
    for (const file of sourceFiles) {
      this.detectFileFindings(file.path, file.content, findings);
    }

    // ── Graph-based analysis ─────────────────────────────────────────────────
    if (graph) {
      const inboundMap = new Map<string, number>();
      for (const edge of graph.edges) {
        inboundMap.set(edge.target, (inboundMap.get(edge.target) ?? 0) + 1);
      }

      for (const node of graph.nodes) {
        const inbound = inboundMap.get(node.id) ?? 0;
        const isSensitive = this.isSensitiveName(node.name);

        // Security-relevant components: sensitive name (any count)
        if (isSensitive) {
          relevant.push({
            name: node.name,
            filePath: node.path,
            reason: 'Name suggests security-sensitive responsibility.',
            role: this.deriveComponentRole(node.name),
            patterns: this.matchedPatterns(node.name),
          });
        }

        // Broad-access finding: sensitive name AND high inbound coupling
        if (isSensitive && inbound >= HIGH_COUPLING_THRESHOLD) {
          findings.push({
            id: `broad-${node.id}`,
            title: `Widely Exposed Security Component: ${node.name}`,
            severity: inbound >= HIGH_COUPLING_THRESHOLD * 2 ? 'high' : 'medium',
            category: 'broad-access',
            fileName: node.name,
            filePath: node.path,
            issueDescription: `${node.name} handles security-sensitive operations and is directly depended on by ${inbound} other files.`,
            riskExplanation: `A vulnerability in this component propagates across all ${inbound} dependents. Wide exposure increases the blast radius of any security defect.`,
            remediation: 'Introduce a narrow interface or facade in front of this component. Ensure all callers validate their inputs independently. Consider audit logging for operations performed through this component.',
            affectedComponents: this.getDirectDependents(node.id, graph, 5),
            affectedWorkflows: [],
          });
        }
      }

      // Circular dependencies involving sensitive nodes
      const sensitiveNodeIds = new Set(
        graph.nodes.filter(n => this.isSensitiveName(n.name)).map(n => n.id)
      );
      const cycleNodes = this.detectCycleNodes(graph);
      const secureCycles = cycleNodes.filter(id => sensitiveNodeIds.has(id));
      if (secureCycles.length > 0) {
        const names = secureCycles.map(id => graph.nodes.find(n => n.id === id)?.name ?? id).slice(0, 3);
        findings.push({
          id: 'cycle-security',
          title: `Circular Dependencies Involving Security Components`,
          severity: 'medium',
          category: 'authentication',
          fileName: names[0],
          issueDescription: `Security-sensitive components (${names.join(', ')}) are part of circular dependency chains.`,
          riskExplanation: 'Circular dependencies in security-critical modules can cause initialization order issues and make the components harder to isolate, test, and audit.',
          remediation: 'Break circular dependencies by extracting shared state into a separate module. Dependency inversion (depend on an interface, not a concrete class) resolves most circular dependency situations.',
          affectedComponents: names,
          affectedWorkflows: [],
        });
      }
    }

    // ── AI findings from session ─────────────────────────────────────────────
    const ai = session?.aiAnalysis;
    if (ai?.risks) {
      for (const risk of ai.risks) {
        if (this.isSecurityRisk(risk.title + ' ' + risk.description)) {
          const primaryFile = sourceFiles[0]?.path.split('/').pop() ?? 'Unknown';
          if (!findings.some(f => f.title === risk.title)) {
            findings.push({
              id: `ai-${findings.length}`,
              title: risk.title,
              severity: this.mapAiSeverity(risk.severity),
              category: 'ai-finding',
              fileName: primaryFile,
              issueDescription: risk.description,
              riskExplanation: 'Identified by AI security analysis.',
              remediation: 'Review the AI recommendation in the Recommendations page for full context and suggested fix.',
              affectedComponents: [primaryFile],
              affectedWorkflows: [],
            });
          }
        }
      }
    }

    // ── Hotspots from findings ───────────────────────────────────────────────
    const fileFindingCounts = new Map<string, SecurityFinding[]>();
    for (const f of findings) {
      const key = f.fileName;
      if (!fileFindingCounts.has(key)) fileFindingCounts.set(key, []);
      fileFindingCounts.get(key)!.push(f);
    }

    for (const [fileName, filefindings] of fileFindingCounts.entries()) {
      if (filefindings.length >= 2) {
        const maxSev = this.maxSeverity(filefindings.map(f => f.severity));
        hotspots.push({
          name: fileName,
          findingCount: filefindings.length,
          riskLevel: maxSev,
          explanation: `This file contains ${filefindings.length} security findings. ${this.hotspotExplanation(filefindings)}`,
        });
      }
    }

    // Sort hotspots by finding count descending
    hotspots.sort((a, b) => b.findingCount - a.findingCount);

    return this.buildAnalysis(findings, relevant, hotspots, now);
  }

  // ── Per-file pattern detection ─────────────────────────────────────────────

  private detectFileFindings(filePath: string, content: string, findings: SecurityFinding[]): void {
    if (!content || !content.trim()) return;

    const fileName = filePath.split('/').pop() ?? filePath;

    // Hardcoded secrets
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        const loc = this.extractSnippet(content, pattern);
        findings.push({
          id: `secret-${findings.length}`,
          title: `Potential Hardcoded Secret in ${fileName}`,
          severity: 'high',
          category: 'secrets-management',
          fileName,
          filePath,
          lineStart: loc?.lineStart,
          lineEnd: loc?.lineEnd,
          codeSnippet: loc?.snippet ?? undefined,
          issueDescription: 'A pattern consistent with a hardcoded credential, secret, or connection string was detected.',
          riskExplanation: 'Hardcoded secrets are exposed in source control, build logs, and any environment where the code runs. They cannot be rotated without a code change and deployment.',
          remediation: 'Move secrets to environment variables, a secrets manager (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault), or a configuration service. Never commit credentials to source control.',
          affectedComponents: [fileName],
          affectedWorkflows: [],
        });
        break; // one finding per file for this category
      }
    }

    // SQL injection patterns
    const lowerContent = content.toLowerCase();
    const hasSqlContext = lowerContent.includes('select') || lowerContent.includes('insert') ||
                          lowerContent.includes('update') || lowerContent.includes('delete') ||
                          lowerContent.includes('execute') || lowerContent.includes('sqlcommand') ||
                          lowerContent.includes('dbcommand') || lowerContent.includes('query');
    if (hasSqlContext) {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(content)) {
          const loc = this.extractSnippet(content, pattern);
          findings.push({
            id: `sqli-${findings.length}`,
            title: `Potential SQL Injection Pattern in ${fileName}`,
            severity: 'high',
            category: 'sql-injection',
            fileName,
            filePath,
            lineStart: loc?.lineStart,
            lineEnd: loc?.lineEnd,
            codeSnippet: loc?.snippet ?? undefined,
            issueDescription: 'String concatenation was detected in what appears to be a SQL query context. This is a common SQL injection pattern.',
            riskExplanation: 'SQL injection allows attackers to manipulate database queries, potentially reading, modifying, or deleting data — and in some configurations, executing system commands.',
            remediation: 'Replace all string-concatenated queries with parameterized queries or an ORM. In C#, use SqlParameter or Entity Framework. In TypeScript, use a parameterized query builder.',
            affectedComponents: [fileName],
            affectedWorkflows: [],
          });
          break;
        }
      }
    }

    // Unsafe file operations (writing user input to file paths)
    const fileOpLoc = this.extractSnippet(content, /File\.(WriteAll|Create|Open|Copy|Move)/i);
    if (fileOpLoc && /Request\.|input\.|param\./i.test(content)) {
      findings.push({
        id: `fileop-${findings.length}`,
        title: `Unsafe File Operation in ${fileName}`,
        severity: 'medium',
        category: 'file-access',
        fileName,
        filePath,
        lineStart: fileOpLoc.lineStart,
        lineEnd: fileOpLoc.lineEnd,
        codeSnippet: fileOpLoc.snippet,
        issueDescription: 'A file operation was detected in proximity to request parameters or user input, suggesting that file paths or content may be user-controlled.',
        riskExplanation: 'Allowing user-controlled file paths enables path traversal attacks. Attackers can read or write files outside the intended directory using patterns like ../../etc/passwd.',
        remediation: 'Validate and sanitize all file paths. Use a whitelist of allowed directories. Never use user input directly as a file path.',
        affectedComponents: [fileName],
        affectedWorkflows: [],
      });
    }

    // Missing authorization on controllers/endpoints
    const httpVerbLoc = this.extractSnippet(content, /\[(HttpGet|HttpPost|HttpPut|HttpDelete)\]/i);
    if (
      httpVerbLoc &&
      !content.includes('[Authorize]') &&
      !content.includes('[AllowAnonymous]') &&
      (content.includes('Controller') || content.includes('controller'))
    ) {
      findings.push({
        id: `authz-${findings.length}`,
        title: `Controller Endpoints Without Authorization in ${fileName}`,
        severity: 'high',
        category: 'authorization',
        fileName,
        filePath,
        lineStart: httpVerbLoc.lineStart,
        lineEnd: httpVerbLoc.lineEnd,
        codeSnippet: httpVerbLoc.snippet,
        issueDescription: 'HTTP endpoints were detected in a controller that has no [Authorize] or [AllowAnonymous] attributes.',
        riskExplanation: 'Without explicit authorization, all endpoints are effectively public. This can expose sensitive operations to unauthenticated callers.',
        remediation: 'Add [Authorize] to the controller class to secure all endpoints by default. Add [AllowAnonymous] explicitly only to endpoints that should be publicly accessible.',
        affectedComponents: [fileName],
        affectedWorkflows: [],
      });
    }

    // Sensitive data in logs
    const logLoc = this.extractSnippet(content, /log\.(info|warn|error|debug|trace|write)/i);
    if (logLoc && /password|secret|token|ssn|creditcard|credit_card/i.test(content)) {
      findings.push({
        id: `logdata-${findings.length}`,
        title: `Sensitive Data May Be Written to Logs in ${fileName}`,
        severity: 'medium',
        category: 'configuration',
        fileName,
        filePath,
        lineStart: logLoc.lineStart,
        lineEnd: logLoc.lineEnd,
        codeSnippet: logLoc.snippet,
        issueDescription: 'Logging statements are present in the same file as references to sensitive fields (password, token, secret, SSN, credit card). Sensitive data may be inadvertently logged.',
        riskExplanation: 'Log files are often stored, forwarded to log aggregators, and accessed by operations staff. Logging sensitive data violates data minimization principles and may breach compliance requirements.',
        remediation: 'Review all log statements. Redact or omit sensitive fields. Use structured logging with field-level redaction policies.',
        affectedComponents: [fileName],
        affectedWorkflows: [],
      });
    }
  }

  // ── Build full SecurityAnalysis from findings ──────────────────────────────

  private buildAnalysis(
    findings: SecurityFinding[],
    relevant: SecurityRelevantComponent[],
    hotspots: SecurityHotspot[],
    now: string,
  ): SecurityAnalysis {
    const deduped = this.deduplicateRelevant(relevant);
    const overallRisk = this.deriveOverallRisk(findings);
    const maturity = this.deriveMaturity(findings);
    const themes = this.deriveThemes(findings);
    const summary = this.deriveSummary(findings, overallRisk);
    const executiveSummary = this.deriveExecutiveSummary(findings, overallRisk, maturity, deduped);
    const riskContext = this.deriveRiskContext(findings, overallRisk);
    const maturityContext = this.deriveMaturityContext(maturity, findings);
    const assessment = this.deriveAssessment(findings, overallRisk, deduped);

    return {
      executiveSummary,
      summary,
      overallRisk,
      securityMaturity: maturity,
      maturityContext,
      riskContext,
      findings,
      hotspots,
      relevantComponents: deduped,
      recommendationThemes: themes,
      readinessAssessment: assessment,
      generatedAt: now,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isSensitiveName(name: string): boolean {
    const lower = (name.split('/').pop() ?? name).toLowerCase();
    return SENSITIVE_NAME_PATTERNS.some(p => lower.includes(p));
  }

  private matchedPatterns(name: string): string[] {
    const lower = (name.split('/').pop() ?? name).toLowerCase();
    return SENSITIVE_NAME_PATTERNS.filter(p => lower.includes(p));
  }

  private isSecurityRisk(text: string): boolean {
    const lower = text.toLowerCase();
    return SENSITIVE_NAME_PATTERNS.some(p => lower.includes(p)) ||
      ['injection', 'xss', 'csrf', 'exploit', 'vulnerability', 'attack',
       'malicious', 'sanitiz', 'unauthori', 'exposure'].some(k => lower.includes(k));
  }

  private mapAiSeverity(s: string): SecuritySeverity {
    const l = (s ?? '').toLowerCase();
    if (l === 'critical') return 'critical';
    if (l === 'high')     return 'high';
    if (l === 'medium')   return 'medium';
    return 'low';
  }

  private maxSeverity(severities: SecuritySeverity[]): SecuritySeverity {
    const order: SecuritySeverity[] = ['critical', 'high', 'medium', 'low'];
    for (const s of order) {
      if (severities.includes(s)) return s;
    }
    return 'low';
  }

  private deriveOverallRisk(findings: SecurityFinding[]): SecuritySeverity {
    if (findings.some(f => f.severity === 'critical')) return 'critical';
    if (findings.some(f => f.severity === 'high'))     return 'high';
    if (findings.some(f => f.severity === 'medium'))   return 'medium';
    if (findings.length > 0)                           return 'low';
    return 'low';
  }

  private deriveMaturity(findings: SecurityFinding[]): 'Low' | 'Medium' | 'High' {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high     = findings.filter(f => f.severity === 'high').length;
    if (critical > 0 || high >= 3) return 'Low';
    if (high >= 1 || findings.length >= 3) return 'Medium';
    return 'High';
  }

  private deriveThemes(findings: SecurityFinding[]): string[] {
    const themes: string[] = [];
    const cats = new Set(findings.map(f => f.category));
    if (cats.has('secrets-management')) themes.push('Improve Secrets Management');
    if (cats.has('authentication'))     themes.push('Strengthen Authentication Controls');
    if (cats.has('authorization'))      themes.push('Review Authorization Boundaries');
    if (cats.has('input-validation'))   themes.push('Strengthen Input Validation');
    if (cats.has('sql-injection'))      themes.push('Eliminate SQL Injection Risks');
    if (cats.has('file-access'))        themes.push('Secure File Access Operations');
    if (cats.has('external-calls'))     themes.push('Harden External Integrations');
    if (cats.has('configuration'))      themes.push('Improve Security Configuration');
    if (cats.has('broad-access'))       themes.push('Reduce Security Component Exposure');
    return themes;
  }

  private deriveSummary(findings: SecurityFinding[], risk: SecuritySeverity): string {
    const count = findings.length;
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;

    if (count === 0) {
      return 'No significant security findings were detected during heuristic analysis. The codebase appears to follow basic security practices for the patterns examined. AI-enhanced analysis may reveal additional concerns when available.';
    }

    const riskLabel = risk === 'critical' ? 'critical' : risk === 'high' ? 'elevated' : risk === 'medium' ? 'moderate' : 'low';

    let summary = `This codebase presents ${riskLabel} security risk based on heuristic analysis. `;

    if (critical > 0) {
      summary += `${critical} critical finding${critical > 1 ? 's' : ''} require${critical === 1 ? 's' : ''} immediate attention. `;
    } else if (high > 0) {
      summary += `${high} high-severity finding${high > 1 ? 's were' : ' was'} identified. `;
    }

    const categories = [...new Set(findings.map(f => f.category))];
    const primaryCategory = this.categoryLabel(categories[0]);
    summary += `The primary concern area is ${primaryCategory}.`;

    if (findings.length > 3) {
      summary += ` A total of ${count} findings were detected across ${categories.length} concern area${categories.length > 1 ? 's' : ''}.`;
    }

    return summary;
  }

  private deriveAssessment(
    findings: SecurityFinding[],
    risk: SecuritySeverity,
    relevant: SecurityRelevantComponent[],
  ): string {
    const high = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    const positives: string[] = [];
    const concerns: string[] = [];

    if (high.length === 0) positives.push('no critical or high-severity vulnerabilities were detected');
    if (relevant.length > 0) positives.push(`${relevant.length} security-sensitive component${relevant.length > 1 ? 's were' : ' was'} identified and documented`);

    for (const f of high.slice(0, 3)) {
      concerns.push(f.title);
    }

    let assessment = '';

    if (findings.length === 0) {
      assessment = 'Heuristic analysis did not surface security findings in the examined code. This does not mean the codebase is free of vulnerabilities — manual review and dedicated security tooling are always recommended for production systems. ';
    } else {
      assessment = `The security posture of this codebase is ${risk}. `;

      if (concerns.length > 0) {
        assessment += `The most significant concerns are: ${concerns.join('; ')}. These should be prioritized in the next development cycle. `;
      }
    }

    if (positives.length > 0) {
      assessment += `On the positive side, ${positives.join(' and ')}. `;
    }

    assessment += 'Recommended next steps: (1) Address all critical and high-severity findings. (2) Review security-relevant components for input validation and proper authorization. (3) Engage dedicated security tooling (Snyk, SonarQube, or similar) for comprehensive coverage.';

    return assessment;
  }

  private deriveExecutiveSummary(
    findings: SecurityFinding[],
    risk: SecuritySeverity,
    maturity: 'Low' | 'Medium' | 'High',
    relevant: SecurityRelevantComponent[],
  ): string {
    const count = findings.length;
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const cats = [...new Set(findings.map(f => f.category))];

    if (count === 0) {
      return `No significant security concerns were identified during heuristic analysis. The codebase does not exhibit common vulnerability patterns such as hardcoded credentials, SQL injection vectors, or missing authorization controls. ${relevant.length > 0 ? `${relevant.length} security-sensitive component${relevant.length > 1 ? 's were' : ' was'} identified for awareness — these are not findings, but areas worth reviewing during code changes.` : ''} Security maturity appears ${maturity.toLowerCase()} based on the patterns examined. Manual review and dedicated security tooling are always recommended before production deployment.`;
    }

    const riskWord = risk === 'critical' ? 'critical' : risk === 'high' ? 'elevated' : risk === 'medium' ? 'moderate' : 'low';
    let summary = `This codebase presents ${riskWord} security risk. `;

    if (critical > 0) {
      summary += `${critical} critical finding${critical > 1 ? 's require' : ' requires'} immediate attention before this code should be deployed to production. `;
    } else if (high > 0) {
      summary += `${high} high-severity finding${high > 1 ? 's were' : ' was'} identified that should be prioritized in the next development cycle. `;
    }

    if (cats.length > 0) {
      const primaryCats = cats.slice(0, 2).map(c => this.categoryLabel(c));
      summary += `The primary concern area${primaryCats.length > 1 ? 's are' : ' is'} ${primaryCats.join(' and ')}. `;
    }

    if (relevant.length > 0) {
      summary += `${relevant.length} security-sensitive component${relevant.length > 1 ? 's were' : ' was'} identified — these handle operations such as authentication, authorization, or secrets management and deserve careful review during any changes. `;
    }

    summary += `Security maturity is assessed as ${maturity.toLowerCase()}: ${maturity === 'Low' ? 'foundational security practices appear inconsistent or absent in critical areas' : maturity === 'Medium' ? 'basic security practices are present but applied inconsistently' : 'security controls appear generally sound with only minor concerns'}.`;

    return summary;
  }

  private deriveRiskContext(findings: SecurityFinding[], risk: SecuritySeverity): string {
    const count = findings.length;
    if (count === 0) return 'No findings detected. Heuristic analysis found no common vulnerability patterns.';
    const high = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    if (risk === 'critical') return `Critical issues present. ${high} high-or-critical finding${high > 1 ? 's require' : ' requires'} immediate remediation.`;
    if (risk === 'high') return `Elevated risk. ${high} finding${high > 1 ? 's' : ''} should be addressed before the next release.`;
    if (risk === 'medium') return `Moderate risk. Most concerns relate to configuration and validation patterns.`;
    return `Low risk. Minor concerns identified, none critical.`;
  }

  private deriveMaturityContext(maturity: 'Low' | 'Medium' | 'High', findings: SecurityFinding[]): string {
    const cats = [...new Set(findings.map(f => f.category))];
    if (maturity === 'High') return 'Basic security practices appear consistently applied. No critical or high-severity patterns detected.';
    if (maturity === 'Medium') {
      const concern = cats[0] ? `Primary gap: ${this.categoryLabel(cats[0])}.` : '';
      return `Security practices are present but applied inconsistently. ${concern}`.trim();
    }
    return 'Security practices appear absent or inconsistent in critical areas. Multiple high-severity concerns identified.';
  }

  private deriveComponentRole(name: string): string {
    const lower = (name.split('/').pop() ?? name).toLowerCase();
    if (lower.includes('auth') || lower.includes('oauth')) return 'Handles authentication flows and identity verification';
    if (lower.includes('jwt') || lower.includes('token')) return 'Manages token generation, validation, or lifecycle';
    if (lower.includes('secret') || lower.includes('credential')) return 'Stores or retrieves secrets and credentials';
    if (lower.includes('password') || lower.includes('hash') || lower.includes('salt')) return 'Handles password hashing or verification';
    if (lower.includes('permission') || lower.includes('role') || lower.includes('claim') || lower.includes('privilege')) return 'Manages permissions, roles, or access control decisions';
    if (lower.includes('session')) return 'Manages user sessions and session state';
    if (lower.includes('encrypt') || lower.includes('decrypt')) return 'Performs cryptographic operations';
    if (lower.includes('security')) return 'Provides general security infrastructure or policy enforcement';
    if (lower.includes('identity')) return 'Manages user identity and principal resolution';
    return 'Involved in security-sensitive operations';
  }

  private categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'secrets-management': 'secrets management',
      'authentication': 'authentication',
      'authorization': 'authorization',
      'input-validation': 'input validation',
      'sql-injection': 'SQL injection prevention',
      'file-access': 'file access security',
      'external-calls': 'external integration security',
      'configuration': 'security configuration',
      'broad-access': 'security component exposure',
      'ai-finding': 'AI-identified security concerns',
    };
    return labels[cat] ?? cat;
  }

  private hotspotExplanation(findings: SecurityFinding[]): string {
    const cats = [...new Set(findings.map(f => this.categoryLabel(f.category)))];
    return `Concerns span: ${cats.slice(0, 3).join(', ')}.`;
  }

  private extractSnippet(content: string, pattern: RegExp): { snippet: string; lineStart: number; lineEnd: number } | null {
    const match = pattern.exec(content);
    if (!match) return null;
    const idx = match.index;
    const lines = content.split('\n');
    let pos = 0;
    for (let i = 0; i < lines.length; i++) {
      if (pos + lines[i].length >= idx) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length - 1, i + 2);
        return {
          snippet: lines.slice(start, end + 1).join('\n'),
          lineStart: start + 1,  // 1-indexed
          lineEnd: end + 1,
        };
      }
      pos += lines[i].length + 1;
    }
    return { snippet: match[0].slice(0, 120), lineStart: 1, lineEnd: 1 };
  }

  private deduplicateRelevant(relevant: SecurityRelevantComponent[]): SecurityRelevantComponent[] {
    const seen = new Set<string>();
    return relevant.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
  }

  private getDirectDependents(nodeId: string, graph: { nodes: DependencyNode[]; edges: { source: string; target: string }[] }, limit: number): string[] {
    const sourceIds = graph.edges.filter(e => e.target === nodeId).map(e => e.source);
    return graph.nodes
      .filter(n => sourceIds.includes(n.id))
      .slice(0, limit)
      .map(n => n.name);
  }

  private detectCycleNodes(graph: { nodes: DependencyNode[]; edges: { source: string; target: string }[] }): string[] {
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) adj.set(n.id, []);
    for (const e of graph.edges) adj.get(e.source)?.push(e.target);

    const inCycle = new Set<string>();
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      stack.add(id);
      for (const neighbor of adj.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) inCycle.add(id);
        } else if (stack.has(neighbor)) {
          inCycle.add(id);
          inCycle.add(neighbor);
          return true;
        }
      }
      stack.delete(id);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    return [...inCycle];
  }
}
