import { Injectable } from '@angular/core';
import { SecurityAnalysis, SecurityFinding } from '@app/analysis/models/security-analysis.model';

export interface SecurityOverviewContext {
  workspaceName: string;
  languages: string[];
  technologies: string[];
  architecturePatterns: string[];
  security: SecurityAnalysis;
  scope: 'file' | 'folder' | 'repository';
}

@Injectable({ providedIn: 'root' })
export class SecurityOverviewPromptBuilder {

  build(ctx: SecurityOverviewContext): string {
    const parts: string[] = [];
    const { security, scope } = ctx;

    const criticalCount = security.findings.filter(f => f.severity === 'critical').length;
    const highCount     = security.findings.filter(f => f.severity === 'high').length;
    const mediumCount   = security.findings.filter(f => f.severity === 'medium').length;
    const lowCount      = security.findings.filter(f => f.severity === 'low').length;
    const totalFindings = security.findings.length;

    const categories = [...new Set(security.findings.map(f => f.category))];
    const hasAuth    = categories.some(c => c === 'authentication' || c === 'authorization');
    const hasSecrets = categories.some(c => c === 'secrets-management');
    const hasSql     = categories.some(c => c === 'sql-injection');
    const hasInput   = categories.some(c => c === 'input-validation');
    const hasDeps    = categories.some(c => c === 'external-calls');

    parts.push(`You are a senior security engineer writing a concise security assessment.`);
    parts.push(`Write in plain prose. No bullet lists. No headers. Do not invent details not present in the data. Do not recommend fixes — describe the current state only.`);
    parts.push(``);

    if (scope === 'file') {
      if (totalFindings === 0) {
        parts.push(`Output: one sentence only. State that no significant security concerns were detected in this file.`);
      } else {
        parts.push(`Output: 1 short paragraph, 40–80 words. Characterise the security posture of this single file. Name the most significant finding if one exists. Do not pad with generic advice.`);
      }
    } else if (scope === 'folder') {
      parts.push(`Output: 2 short paragraphs, 80–150 words total. Cover: (1) overall posture of this folder, (2) the most significant concern if any findings exist. Stop there.`);
    } else {
      parts.push(`Output: 3–4 paragraphs, 150–250 words. Cover: (1) overall posture and what drives the risk level, (2) most significant concerns, (3) confidence in the findings, (4) readiness for production use.`);
    }

    parts.push(``);
    parts.push(`File/system: ${ctx.workspaceName}`);

    if (ctx.languages.length > 0) {
      parts.push(`Languages: ${ctx.languages.join(', ')}`);
    }
    if (ctx.technologies.length > 0 && scope !== 'file') {
      parts.push(`Technologies: ${ctx.technologies.join(', ')}`);
    }
    if (ctx.architecturePatterns.length > 0 && scope === 'repository') {
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

    if (security.relevantComponents.length > 0 && scope !== 'file') {
      const names = security.relevantComponents.slice(0, 5).map(c => c.name).join(', ');
      parts.push(`Security-relevant components: ${names}`);
    }

    if (totalFindings > 0) {
      const maxFindings = scope === 'file' ? 2 : scope === 'folder' ? 3 : 5;
      const top = this.topFindings(security.findings).slice(0, maxFindings);
      parts.push(``);
      parts.push(`Most significant findings:`);
      for (const f of top) {
        parts.push(`- [${f.severity}] ${f.title}${scope !== 'file' ? ` (${f.fileName})` : ''}: ${f.issueDescription}`);
      }
    }

    parts.push(``, `Do not use section headings. Synthesise the data above into a professional narrative matching the output format above.`);

    return parts.join('\n');
  }

  private topFindings(findings: SecurityFinding[]): SecurityFinding[] {
    const order = ['critical', 'high', 'medium', 'low'];
    return [...findings]
      .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
      .slice(0, 5);
  }
}
