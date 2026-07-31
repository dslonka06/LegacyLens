import { Injectable } from '@angular/core';
import type {
  SecurityEvidenceReport,
  SecurityFinding,
  SecuritySeverity,
} from '@app/analysis/models/security-analysis.model';

export interface SecurityFindingsContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  languages: string[];
  evidence: SecurityEvidenceReport;
}

export interface SecurityLLMResponse {
  postureSummary: string;
  overallRisk: SecuritySeverity;
  securityMaturity: 'Low' | 'Medium' | 'High';
  findings: SecurityFinding[];
}

@Injectable({ providedIn: 'root' })
export class SecurityFindingsPromptBuilder {

  build(ctx: SecurityFindingsContext): string {
    const parts: string[] = [];
    const { workspaceName, scope, languages, evidence } = ctx;
    const { candidates, domainEvidence: de, fileCount } = evidence;

    // ── Persona ──────────────────────────────────────────────────────────────
    parts.push(
      'You are a senior application security engineer performing a static analysis review.',
      'You have been given structured evidence gathered by automated pattern scanning.',
      'Your task is to:',
      '  1. Review the candidate findings and determine which are real vulnerabilities vs false positives.',
      '  2. Assign accurate severity based on context, not just pattern match.',
      '  3. Write a brief security posture summary.',
      '',
      'Output ONLY a valid JSON object. No markdown, no explanation, no wrapper text — raw JSON only.',
      '',
    );

    // ── Output schema ────────────────────────────────────────────────────────
    parts.push(
      'The JSON must match this exact schema:',
      '{',
      '  "postureSummary": "string — 2-4 sentences contextualising the overall security posture",',
      '  "overallRisk": "critical | high | medium | low",',
      '  "securityMaturity": "Low | Medium | High",',
      '  "findings": [',
      '    {',
      '      "id": "string",',
      '      "title": "string",',
      '      "severity": "critical | high | medium | low",',
      '      "category": "secrets-management | authentication | authorization | input-validation | sql-injection | file-access | external-calls | configuration | cryptography",',
      '      "fileName": "string — filename only, no path",',
      '      "filePath": "string — relative path",',
      '      "lineStart": "number or null",',
      '      "lineEnd": "number or null",',
      '      "candidateIndex": "number or null — 0-based index into CANDIDATE FINDINGS if based on one",',
      '      "issueDescription": "string — what is wrong and where",',
      '      "riskExplanation": "string — why this is exploitable and what the impact is",',
      '      "remediation": "string — specific actionable steps to fix this"',
      '    }',
      '  ]',
      '}',
      '',
      'CONSTRAINTS:',
      '- Maximum 10 findings. Only include confirmed real issues — not every candidate needs to become a finding.',
      '- Order findings severity descending: critical → high → medium → low.',
      '- For candidateIndex: copy lineStart/lineEnd from the matching candidate. Do not invent line numbers.',
      '',
    );

    // ── Evidence block ────────────────────────────────────────────────────────
    parts.push(`WORKSPACE: ${workspaceName} (${scope}, ${fileCount} files, ${languages.join(' / ') || 'unknown language'})`);
    parts.push('');

    // Candidates
    if (candidates.length > 0) {
      parts.push(`CANDIDATE FINDINGS (pattern matches — confirm, adjust severity, or reject as false positive):`);
      candidates.forEach((c, i) => {
        parts.push(`  ${i + 1}. [${c.pattern}] ${c.file}:${c.lineStart}`);
        parts.push(`     Pattern: ${c.patternDescription}`);
        if (c.snippet) {
          const indented = c.snippet.split('\n').map(l => `       ${l}`).join('\n');
          parts.push(`     Snippet (lines ${c.lineStart}–${c.lineEnd}):`);
          parts.push(indented);
        }
        parts.push('');
      });
    } else {
      parts.push('CANDIDATE FINDINGS: None. No high-confidence pattern matches were detected.');
      parts.push('');
    }

    // Domain evidence (context only — verification is handled separately)
    parts.push('DOMAIN EVIDENCE SUMMARY (context for posture assessment):');
    parts.push('');

    const sec = de.secrets;
    if (sec.hardcodedHits > 0 || sec.envVarRefs > 0 || sec.secretsManagerRefs > 0) {
      parts.push('  Secrets:');
      if (sec.hardcodedHits > 0)       parts.push(`    - Hardcoded credential hits: ${sec.hardcodedHits}`);
      if (sec.envVarRefs > 0)          parts.push(`    - Environment variable references: ${sec.envVarRefs}`);
      if (sec.secretsManagerRefs > 0)  parts.push(`    - Secrets manager references: ${sec.secretsManagerRefs}`);
      parts.push('');
    }

    const iv = de.inputValidation;
    if (iv.frameworkDetected || iv.validationAttributes > 0 || iv.guardClauseCount > 0 || iv.unvalidatedEntryPoints > 0) {
      parts.push('  Input Validation:');
      if (iv.frameworkDetected)          parts.push(`    - Framework: ${iv.frameworkDetected}`);
      if (iv.validationAttributes > 0)   parts.push(`    - Validation attributes: ${iv.validationAttributes}`);
      if (iv.guardClauseCount > 0)       parts.push(`    - Guard clauses: ${iv.guardClauseCount}`);
      if (iv.unvalidatedEntryPoints > 0) parts.push(`    - HTTP entry points with no visible validation: ${iv.unvalidatedEntryPoints}`);
      parts.push('');
    }

    const auth = de.authentication;
    if (auth.frameworkDetected || auth.protectedSurfaces > 0 || auth.unprotectedHttpVerbs > 0 || auth.middlewareFound) {
      parts.push('  Authentication:');
      if (auth.frameworkDetected)        parts.push(`    - Framework: ${auth.frameworkDetected}`);
      if (auth.middlewareFound)          parts.push('    - Auth middleware present');
      if (auth.protectedSurfaces > 0)    parts.push(`    - Protected surfaces: ${auth.protectedSurfaces}`);
      if (auth.unprotectedHttpVerbs > 0) parts.push(`    - Unprotected HTTP endpoints: ${auth.unprotectedHttpVerbs}`);
      parts.push('');
    }

    const da = de.dataAccess;
    if (da.ormDetected || da.parameterisedCount > 0 || da.concatenatedCount > 0) {
      parts.push('  Data Access:');
      if (da.ormDetected)              parts.push(`    - ORM: ${da.ormDetected}`);
      if (da.parameterisedCount > 0)   parts.push(`    - Parameterised queries: ${da.parameterisedCount}`);
      if (da.concatenatedCount > 0)    parts.push(`    - SQL string concatenation: ${da.concatenatedCount}`);
      parts.push('');
    }

    const eh = de.errorHandling;
    if (eh.tryCatchCount > 0 || eh.emptyCatchCount > 0 || eh.stackExposureCount > 0) {
      parts.push('  Error Handling:');
      if (eh.tryCatchCount > 0)        parts.push(`    - try/catch blocks: ${eh.tryCatchCount}`);
      if (eh.emptyCatchCount > 0)      parts.push(`    - Empty catch blocks: ${eh.emptyCatchCount}`);
      if (eh.stackExposureCount > 0)   parts.push(`    - Stack trace exposure: ${eh.stackExposureCount}`);
      parts.push('');
    }

    const crypto = de.cryptography;
    if (crypto.weakAlgorithms.length > 0 || crypto.hardcodedIvOrKey > 0) {
      parts.push('  Cryptography:');
      if (crypto.weakAlgorithms.length > 0)  parts.push(`    - Weak algorithms: ${crypto.weakAlgorithms.join(', ')}`);
      if (crypto.hardcodedIvOrKey > 0)       parts.push(`    - Hardcoded IV or key: ${crypto.hardcodedIvOrKey}`);
      parts.push('');
    }

    parts.push('Based on this evidence, return ONLY the JSON object described above.');
    parts.push('Confirm which candidates are real vulnerabilities and assign accurate severity.');

    return parts.join('\n');
  }

  parse(raw: string): SecurityLLMResponse | null {
    if (!raw) return null;

    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[SecurityFindingsPrompt] JSON.parse failed');
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    if (typeof obj['postureSummary'] !== 'string') return null;
    if (!this._isValidRisk(obj['overallRisk'])) return null;
    if (!this._isValidMaturity(obj['securityMaturity'])) return null;
    if (!Array.isArray(obj['findings'])) return null;

    const findings = (obj['findings'] as unknown[])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .filter(f => typeof f['id'] === 'string' && typeof f['title'] === 'string' && this._isValidRisk(f['severity']))
      .map(f => this._normaliseFinding(f));

    return {
      postureSummary:   obj['postureSummary'] as string,
      overallRisk:      obj['overallRisk'] as SecuritySeverity,
      securityMaturity: obj['securityMaturity'] as 'Low' | 'Medium' | 'High',
      findings,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _normaliseFinding(f: Record<string, unknown>): SecurityFinding {
    const filePath = typeof f['filePath'] === 'string' ? f['filePath'] : '';
    const fileName = typeof f['fileName'] === 'string'
      ? f['fileName']
      : (filePath.split(/[/\\]/).pop() ?? '');

    return {
      id:               typeof f['id'] === 'string' ? f['id'] : `finding-${Math.random().toString(36).slice(2)}`,
      title:            typeof f['title'] === 'string' ? f['title'] : 'Untitled Finding',
      severity:         (f['severity'] as SecuritySeverity) ?? 'low',
      category:         typeof f['category'] === 'string' ? (f['category'] as SecurityFinding['category']) : 'configuration',
      fileName,
      filePath:         filePath || undefined,
      lineStart:        typeof f['lineStart'] === 'number' ? f['lineStart'] : undefined,
      lineEnd:          typeof f['lineEnd'] === 'number' ? f['lineEnd'] : undefined,
      codeSnippet:      undefined,
      issueDescription: typeof f['issueDescription'] === 'string' ? f['issueDescription'] : '',
      riskExplanation:  typeof f['riskExplanation'] === 'string' ? f['riskExplanation'] : '',
      remediation:      typeof f['remediation'] === 'string' ? f['remediation'] : '',
      affectedComponents: [],
      affectedWorkflows: [],
    };
  }

  private _isValidRisk(v: unknown): boolean {
    return v === 'critical' || v === 'high' || v === 'medium' || v === 'low';
  }

  private _isValidMaturity(v: unknown): boolean {
    return v === 'Low' || v === 'Medium' || v === 'High';
  }
}
