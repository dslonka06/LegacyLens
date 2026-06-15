import { Injectable } from '@angular/core';
import { SecurityAnalysis, SecurityFinding } from '../../models/security-analysis.model';

export interface SecurityOverviewContext {
  workspaceName: string;
  languages: string[];
  technologies: string[];
  architecturePatterns: string[];
  security: SecurityAnalysis;
}

@Injectable({ providedIn: 'root' })
export class SecurityOverviewPromptBuilder {

  build(ctx: SecurityOverviewContext): string {
    const parts: string[] = [];
    const { security } = ctx;

    const criticalCount = security.findings.filter(f => f.severity === 'critical').length;
    const highCount     = security.findings.filter(f => f.severity === 'high').length;
    const mediumCount   = security.findings.filter(f => f.severity === 'medium').length;
    const lowCount      = security.findings.filter(f => f.severity === 'low').length;

    const categories = [...new Set(security.findings.map(f => f.category))];
    const hasAuth    = categories.some(c => c === 'authentication' || c === 'authorization');
    const hasSecrets = categories.some(c => c === 'secrets-management');
    const hasSql     = categories.some(c => c === 'sql-injection');
    const hasInput   = categories.some(c => c === 'input-validation');
    const hasDeps    = categories.some(c => c === 'external-calls');

    parts.push(
      `You are a senior security engineer writing a security overview for engineers evaluating an unfamiliar system.`,
      `Your goal is to give them a clear, honest security picture — not a list of issues, but an assessment they can act on.`,
      `Write in plain prose. No bullet lists. No headers. 2–4 paragraphs. Target 150–300 words.`,
      `Do not invent details not present in the data below. Do not recommend fixes — describe the current state.`,
      ``,
    );

    parts.push(`System: ${ctx.workspaceName}`);

    if (ctx.languages.length > 0) {
      parts.push(`Languages: ${ctx.languages.join(', ')}`);
    }
    if (ctx.technologies.length > 0) {
      parts.push(`Technologies: ${ctx.technologies.join(', ')}`);
    }
    if (ctx.architecturePatterns.length > 0) {
      parts.push(`Architecture: ${ctx.architecturePatterns.join(', ')}`);
    }

    parts.push(``);
    parts.push(`Overall risk level: ${security.overallRisk}`);
    parts.push(`Security maturity: ${security.securityMaturity}`);
    parts.push(`Findings: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`);

    const concernAreas: string[] = [];
    if (hasAuth)    concernAreas.push('authentication/authorization');
    if (hasSecrets) concernAreas.push('secrets management');
    if (hasSql)     concernAreas.push('SQL injection risk');
    if (hasInput)   concernAreas.push('input validation');
    if (hasDeps)    concernAreas.push('external service dependencies');
    if (concernAreas.length > 0) {
      parts.push(`Concern areas: ${concernAreas.join(', ')}`);
    }

    if (security.relevantComponents.length > 0) {
      const names = security.relevantComponents.slice(0, 5).map(c => c.name).join(', ');
      parts.push(`Security-relevant components: ${names}`);
    }

    if (security.findings.length > 0) {
      const top = this.topFindings(security.findings);
      parts.push(``);
      parts.push(`Most significant findings:`);
      for (const f of top) {
        parts.push(`- [${f.severity}] ${f.title} (${f.fileName}): ${f.issueDescription}`);
      }
    }

    parts.push(
      ``,
      `Write a security overview with exactly four topics woven into natural paragraphs:`,
      `1. Overall security posture — characterise the risk level and what drives it.`,
      `2. Most significant concerns — what areas of the system carry the most security risk and why.`,
      `3. Security confidence — how confident can an engineer be in these findings given what was analysed.`,
      `4. Readiness assessment — is this system appropriate for internal use, or does it require further review before production.`,
      ``,
      `Do not use section headings. Do not list fixes. Synthesise the data above into a professional narrative.`,
    );

    return parts.join('\n');
  }

  private topFindings(findings: SecurityFinding[]): SecurityFinding[] {
    const order = ['critical', 'high', 'medium', 'low'];
    return [...findings]
      .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
      .slice(0, 5);
  }
}
