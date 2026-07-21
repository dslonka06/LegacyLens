import { Injectable } from '@angular/core';
import { SecurityAnalysis, SecurityFinding } from '@app/analysis/models/security-analysis.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

export interface SecurityOverviewContext {
  workspaceName: string;
  languages: string[];
  technologies: string[];
  architecturePatterns: string[];
  security: SecurityAnalysis;
  scope: 'file' | 'folder' | 'repository';
  architecture?: ArchitectureAIAnalysis | null;
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

    const categories    = [...new Set(security.findings.map(f => f.category))];
    const hasAuth       = categories.some(c => c === 'authentication' || c === 'authorization');
    const hasSecrets    = categories.some(c => c === 'secrets-management');
    const hasSql        = categories.some(c => c === 'sql-injection');
    const hasInput      = categories.some(c => c === 'input-validation');
    const hasDeps       = categories.some(c => c === 'external-calls');

    // ── Persona ──────────────────────────────────────────────────────────────
    parts.push(
      `You are a senior application security engineer who has just completed a static analysis of a codebase.`,
      `You are writing a security brief for the team that owns and maintains this system.`,
      ``,
      `Your goal is to give that team genuine insight — not a count of findings, but an interpretation`,
      `of what the pattern of findings reveals about the security posture and the development habits that produced it.`,
      `The finding list is shown separately. Do not reproduce it.`,
      ``,
      `Reason about: what the combination of risk level, maturity score, finding categories, and affected components`,
      `tells you about where the team has applied security thinking and where they haven't.`,
      `If the finding pattern suggests a specific class of architectural or development habit,`,
      `name it — e.g. input boundaries not validated, secrets left in source because there's no vault pattern,`,
      `auth logic scattered rather than centralised.`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      `Do not prescribe specific fix steps. Do not hedge every claim with "this may indicate."`,
      `State what the evidence suggests, then briefly qualify if the confidence warrants it.`,
      ``,
    );

    // ── Output format ────────────────────────────────────────────────────────
    if (scope === 'file') {
      if (totalFindings === 0) {
        parts.push(`Output: 1 sentence. State there are no significant concerns in this file and what that suggests about it.`);
      } else {
        parts.push(
          `Output: 1 short paragraph, 50–90 words.`,
          `Characterise the security posture of this file based on the type and severity of findings.`,
          `What does the finding pattern say about how this file was written — carefully, hastily, or with a particular blind spot?`,
        );
      }
    } else if (scope === 'folder') {
      parts.push(
        `Output: 2 short paragraphs, 90–150 words.`,
        `Paragraph 1: What does the overall risk level and finding distribution say about how security was considered when building this area?`,
        `Paragraph 2: What is the most significant concern in this area, and what does its presence say about the development practice that produced it?`,
      );
    } else {
      parts.push(
        `Output: 3–4 paragraphs, 160–260 words.`,
        `Paragraph 1: What does the overall risk level and maturity score say about this system's security posture — was security a first-class concern or was it applied inconsistently?`,
        `Paragraph 2: What does the concentration of findings across categories tell you about the team's security blind spots? Are the issues spread across many categories (broad negligence) or concentrated (a specific missing pattern)?`,
        `Paragraph 3: What is the highest-risk surface area, and why does the specific combination of architecture, components, and finding types make it more dangerous than the severity counts alone would suggest?`,
        `Paragraph 4 (only if critical/high count > 0 and maturity is low): What does this system's security posture mean for its readiness to handle production load or external exposure?`,
      );
    }

    parts.push(``);

    // ── Evidence block ───────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);

    if (ctx.languages.length > 0) {
      parts.push(`Languages: ${ctx.languages.join(', ')}`);
    }
    if (ctx.technologies.length > 0 && scope !== 'file') {
      parts.push(`Technologies: ${ctx.technologies.join(', ')}`);
    }
    if (ctx.architecturePatterns.length > 0 && scope === 'repository') {
      parts.push(`Architecture patterns: ${ctx.architecturePatterns.join(', ')}`);
    }

    parts.push(``);
    parts.push(`Overall risk level: ${security.overallRisk}`);
    parts.push(`Security maturity: ${security.securityMaturity}`);
    parts.push(`Findings: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low (${totalFindings} total)`);

    const concernAreas: string[] = [];
    if (hasAuth)    concernAreas.push('authentication/authorization');
    if (hasSecrets) concernAreas.push('secrets management');
    if (hasSql)     concernAreas.push('SQL injection risk');
    if (hasInput)   concernAreas.push('input validation');
    if (hasDeps)    concernAreas.push('external service dependencies');
    if (concernAreas.length > 0) {
      parts.push(`Finding categories present: ${concernAreas.join(', ')}`);
    }

    if (security.relevantComponents.length > 0 && scope !== 'file') {
      const names = security.relevantComponents.slice(0, 6).map(c => c.name).join(', ');
      parts.push(`Security-relevant components: ${names}`);
    }

    if (ctx.architecture) {
      parts.push(``, `Architecture context:`);
      parts.push(`Pattern: ${ctx.architecture.dominantPattern} | Coupling: ${ctx.architecture.couplingAssessment}`);
      if (ctx.architecture.hubCount > 0) {
        parts.push(`Hub nodes (high inbound dependency): ${ctx.architecture.hubCount} — failures in these propagate widely`);
      }
      if (ctx.architecture.boundaryViolations.length > 0) {
        parts.push(`Boundary violations (cross-layer components): ${ctx.architecture.boundaryViolations.slice(0, 3).join(', ')}`);
      }
    }

    if (totalFindings > 0) {
      const maxFindings = scope === 'file' ? 2 : scope === 'folder' ? 3 : 6;
      const top = this._topFindings(security.findings).slice(0, maxFindings);
      parts.push(``, `Most significant findings (for context — do not reproduce verbatim):`);
      for (const f of top) {
        const location = scope !== 'file' ? ` (${f.fileName})` : '';
        parts.push(`- [${f.severity}/${f.category}] ${f.title}${location}: ${f.issueDescription}`);
      }
    }

    parts.push(
      ``,
      `Reason about what the pattern of findings reveals about how this system was built.`,
      `Do not describe the data — interpret it.`,
    );

    return parts.join('\n');
  }

  private _topFindings(findings: SecurityFinding[]): SecurityFinding[] {
    const order = ['critical', 'high', 'medium', 'low'];
    return [...findings].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  }
}
