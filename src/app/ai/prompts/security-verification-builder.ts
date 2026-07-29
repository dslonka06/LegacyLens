import { Injectable } from '@angular/core';
import type {
  SecurityEvidenceReport,
  SecurityVerificationCheck,
  SecurityVerificationDomain,
  VerificationStatus,
} from '@app/analysis/models/security-analysis.model';

@Injectable({ providedIn: 'root' })
export class SecurityVerificationBuilder {

  build(evidence: SecurityEvidenceReport): SecurityVerificationCheck[] {
    const checks: SecurityVerificationCheck[] = [];
    const de = evidence.domainEvidence;

    // ── Secrets ──────────────────────────────────────────────────────────────
    const sec = de.secrets;
    if (sec.hardcodedHits > 0 || sec.envVarRefs > 0 || sec.secretsManagerRefs > 0) {
      if (sec.hardcodedHits > 0) {
        checks.push({
          domain: 'secrets',
          status: 'fail',
          summary: `${sec.hardcodedHits} hardcoded credential pattern${sec.hardcodedHits !== 1 ? 's' : ''} detected.`,
          detail: 'Hardcoded credentials should be moved to environment variables or a secrets manager.',
        });
      } else if (sec.secretsManagerRefs > 0 && sec.envVarRefs > 0) {
        checks.push({
          domain: 'secrets',
          status: 'pass',
          summary: 'Secrets accessed via secrets manager and environment variables — no hardcoded values detected.',
        });
      } else if (sec.secretsManagerRefs > 0) {
        checks.push({
          domain: 'secrets',
          status: 'pass',
          summary: 'Secrets accessed via secrets manager — no hardcoded values detected.',
        });
      } else {
        checks.push({
          domain: 'secrets',
          status: 'warn',
          summary: `${sec.envVarRefs} environment variable reference${sec.envVarRefs !== 1 ? 's' : ''} detected — no secrets manager in use.`,
          detail: 'Consider centralising secret access through a secrets manager for auditability.',
        });
      }
    }

    // ── Input Validation ─────────────────────────────────────────────────────
    const iv = de.inputValidation;
    const hasIvSignal = iv.frameworkDetected || iv.validationAttributes > 0 || iv.guardClauseCount > 0 || iv.unvalidatedEntryPoints > 0;
    if (hasIvSignal) {
      const hasPositive = !!(iv.frameworkDetected) || iv.validationAttributes > 0 || iv.guardClauseCount > 0;
      if (iv.unvalidatedEntryPoints > 0 && !hasPositive) {
        checks.push({
          domain: 'input-validation',
          status: 'fail',
          summary: `${iv.unvalidatedEntryPoints} HTTP endpoint${iv.unvalidatedEntryPoints !== 1 ? 's' : ''} with no visible validation detected.`,
          detail: 'HTTP entry points should validate and sanitise all incoming data before processing.',
        });
      } else if (iv.unvalidatedEntryPoints > 0) {
        checks.push({
          domain: 'input-validation',
          status: 'warn',
          summary: `Validation controls present but ${iv.unvalidatedEntryPoints} endpoint${iv.unvalidatedEntryPoints !== 1 ? 's' : ''} lack visible coverage.`,
          detail: iv.frameworkDetected
            ? `${iv.frameworkDetected} detected — ensure all entry points are covered.`
            : 'Ensure all HTTP entry points are guarded by validation logic.',
        });
      } else {
        const desc = iv.frameworkDetected
          ? `${iv.frameworkDetected} validation framework in use`
          : iv.validationAttributes > 0
            ? `${iv.validationAttributes} validation attribute${iv.validationAttributes !== 1 ? 's' : ''} present`
            : `${iv.guardClauseCount} guard clause${iv.guardClauseCount !== 1 ? 's' : ''} present`;
        checks.push({
          domain: 'input-validation',
          status: 'pass',
          summary: `${desc} — no unprotected entry points detected.`,
        });
      }
    }

    // ── Authentication ────────────────────────────────────────────────────────
    const auth = de.authentication;
    const hasAuthSignal = auth.frameworkDetected || auth.protectedSurfaces > 0 || auth.unprotectedHttpVerbs > 0 || auth.middlewareFound;
    if (hasAuthSignal) {
      if (auth.unprotectedHttpVerbs > 0 && !auth.frameworkDetected && !auth.middlewareFound) {
        checks.push({
          domain: 'authentication',
          status: 'fail',
          summary: `${auth.unprotectedHttpVerbs} HTTP endpoint${auth.unprotectedHttpVerbs !== 1 ? 's' : ''} with no auth decoration and no auth framework detected.`,
          detail: 'Endpoints should be protected with authentication middleware or attribute-based guards.',
        });
      } else if (auth.unprotectedHttpVerbs > 0) {
        checks.push({
          domain: 'authentication',
          status: 'warn',
          summary: `Auth framework present but ${auth.unprotectedHttpVerbs} endpoint${auth.unprotectedHttpVerbs !== 1 ? 's' : ''} lack explicit auth decoration.`,
          detail: 'Verify these endpoints are intentionally public or protected at a higher level.',
        });
      } else {
        const desc = auth.frameworkDetected ?? (auth.middlewareFound ? 'Auth middleware' : 'Auth controls');
        checks.push({
          domain: 'authentication',
          status: 'pass',
          summary: `${desc} present — no unprotected endpoints detected.`,
        });
      }
    }

    // ── Authorization ─────────────────────────────────────────────────────────
    const authz = de.authorization;
    const authzTotal = authz.roleScopedCount + authz.policyScopedCount + authz.permissionCheckCount + authz.presenceOnlyCount;
    if (authzTotal > 0) {
      const scopedTotal = authz.roleScopedCount + authz.policyScopedCount + authz.permissionCheckCount;
      if (authz.presenceOnlyCount > 0 && scopedTotal === 0) {
        checks.push({
          domain: 'authorization',
          status: 'warn',
          summary: `${authz.presenceOnlyCount} presence-only [Authorize] without role or policy scope.`,
          detail: 'Presence-only authorization confirms identity but not permission — add role or policy constraints.',
        });
      } else if (authz.presenceOnlyCount > 0) {
        checks.push({
          domain: 'authorization',
          status: 'warn',
          summary: `Mix of scoped (${scopedTotal}) and presence-only (${authz.presenceOnlyCount}) authorization controls.`,
          detail: 'Review presence-only [Authorize] usages to ensure they are intentionally coarse-grained.',
        });
      } else {
        checks.push({
          domain: 'authorization',
          status: 'pass',
          summary: `${scopedTotal} scoped authorization check${scopedTotal !== 1 ? 's' : ''} — role, policy, or permission-based.`,
        });
      }
    }

    // ── Data Access ───────────────────────────────────────────────────────────
    const da = de.dataAccess;
    const hasDaSignal = da.ormDetected || da.parameterisedCount > 0 || da.concatenatedCount > 0 || da.storedProcedureCount > 0;
    if (hasDaSignal) {
      if (da.concatenatedCount > 0 && !da.ormDetected) {
        checks.push({
          domain: 'data-access',
          status: 'fail',
          summary: `${da.concatenatedCount} SQL string concatenation pattern${da.concatenatedCount !== 1 ? 's' : ''} detected with no ORM present.`,
          detail: 'Use parameterised queries or an ORM to prevent SQL injection.',
        });
      } else if (da.concatenatedCount > 0) {
        checks.push({
          domain: 'data-access',
          status: 'warn',
          summary: `${da.concatenatedCount} SQL concatenation pattern${da.concatenatedCount !== 1 ? 's' : ''} alongside ${da.ormDetected}.`,
          detail: 'Migrate raw SQL concatenation to parameterised queries or ORM methods.',
        });
      } else {
        const desc = da.ormDetected ?? `${da.parameterisedCount} parameterised query pattern${da.parameterisedCount !== 1 ? 's' : ''}`;
        checks.push({
          domain: 'data-access',
          status: 'pass',
          summary: `${desc} — no SQL concatenation patterns detected.`,
        });
      }
    }

    // ── Logging ───────────────────────────────────────────────────────────────
    const log = de.logging;
    const hasLogSignal = log.frameworkDetected || log.sensitiveAdjacentCount > 0 || log.rawConsoleLogCount > 0;
    if (hasLogSignal) {
      if (log.sensitiveAdjacentCount > 0 && log.rawConsoleLogCount > 0) {
        checks.push({
          domain: 'logging',
          status: 'warn',
          summary: `${log.rawConsoleLogCount} raw console.log call${log.rawConsoleLogCount !== 1 ? 's' : ''} in files containing sensitive field names.`,
          detail: 'Review log calls near password/token/secret fields to ensure sensitive data is not logged.',
        });
      } else if (log.sensitiveAdjacentCount > 0) {
        checks.push({
          domain: 'logging',
          status: 'warn',
          summary: `Log calls detected in ${log.sensitiveAdjacentCount} file${log.sensitiveAdjacentCount !== 1 ? 's' : ''} containing sensitive field names.`,
          detail: 'Verify that sensitive values are not included in log output.',
        });
      } else if (log.rawConsoleLogCount > 0 && !log.frameworkDetected) {
        checks.push({
          domain: 'logging',
          status: 'warn',
          summary: `${log.rawConsoleLogCount} raw console.log call${log.rawConsoleLogCount !== 1 ? 's' : ''} — no structured logging framework detected.`,
          detail: 'Consider using a structured logging framework for production code.',
        });
      } else {
        const desc = log.frameworkDetected ?? 'Logging';
        const structured = log.structuredLoggingUsed ? ' with structured logging' : '';
        checks.push({
          domain: 'logging',
          status: 'pass',
          summary: `${desc} in use${structured} — no sensitive data exposure patterns detected.`,
        });
      }
    }

    // ── Error Handling ────────────────────────────────────────────────────────
    const eh = de.errorHandling;
    const hasEhSignal = eh.tryCatchCount > 0 || eh.emptyCatchCount > 0 || eh.globalHandlerFound || eh.stackExposureCount > 0;
    if (hasEhSignal) {
      if (eh.emptyCatchCount > 0 || eh.stackExposureCount > 0) {
        const issues: string[] = [];
        if (eh.emptyCatchCount > 0)    issues.push(`${eh.emptyCatchCount} empty catch block${eh.emptyCatchCount !== 1 ? 's' : ''}`);
        if (eh.stackExposureCount > 0) issues.push(`${eh.stackExposureCount} stack trace exposure${eh.stackExposureCount !== 1 ? 's' : ''}`);
        checks.push({
          domain: 'error-handling',
          status: 'warn',
          summary: issues.join(' and ') + ' detected.',
          detail: 'Empty catches silently swallow errors. Stack traces in responses can expose implementation details.',
        });
      } else {
        const desc = eh.globalHandlerFound ? 'Global exception handler present' : `${eh.tryCatchCount} try/catch block${eh.tryCatchCount !== 1 ? 's' : ''}`;
        checks.push({
          domain: 'error-handling',
          status: 'pass',
          summary: `${desc} — no empty catches or stack exposure detected.`,
        });
      }
    }

    // ── Cryptography ──────────────────────────────────────────────────────────
    const crypto = de.cryptography;
    const hasCryptoSignal = crypto.strongAlgorithms.length > 0 || crypto.weakAlgorithms.length > 0 || crypto.hardcodedIvOrKey > 0;
    if (hasCryptoSignal) {
      if (crypto.weakAlgorithms.length > 0 || crypto.hardcodedIvOrKey > 0) {
        const issues: string[] = [];
        if (crypto.weakAlgorithms.length > 0)  issues.push(`weak algorithms: ${crypto.weakAlgorithms.join(', ')}`);
        if (crypto.hardcodedIvOrKey > 0)       issues.push(`${crypto.hardcodedIvOrKey} hardcoded IV/key`);
        checks.push({
          domain: 'cryptography',
          status: crypto.weakAlgorithms.length > 0 ? 'fail' : 'warn',
          summary: `Cryptography issues detected — ${issues.join('; ')}.`,
          detail: 'Replace weak algorithms (MD5, SHA1, DES) with SHA-256/bcrypt/Argon2. Never hardcode IVs or keys.',
        });
      } else {
        checks.push({
          domain: 'cryptography',
          status: 'pass',
          summary: `Strong algorithms in use: ${crypto.strongAlgorithms.join(', ')}.`,
        });
      }
    }

    // Sort: fail → warn → pass
    const ORDER: Record<VerificationStatus, number> = { fail: 0, warn: 1, pass: 2 };
    checks.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

    return checks;
  }

  hasMeaningfulEvidence(evidence: SecurityEvidenceReport): boolean {
    const de = evidence.domainEvidence;
    // At least one actionable signal — candidates are always meaningful
    if (evidence.candidates.length > 0) return true;
    // Any negative signal is meaningful
    if (de.secrets.hardcodedHits > 0) return true;
    if (de.inputValidation.unvalidatedEntryPoints > 0) return true;
    if (de.authentication.unprotectedHttpVerbs > 0) return true;
    if (de.dataAccess.concatenatedCount > 0) return true;
    if (de.errorHandling.emptyCatchCount > 0 || de.errorHandling.stackExposureCount > 0) return true;
    if (de.cryptography.weakAlgorithms.length > 0 || de.cryptography.hardcodedIvOrKey > 0) return true;
    // Any domain signal at all (for posture context)
    if (de.authentication.frameworkDetected || de.authentication.protectedSurfaces > 0) return true;
    if (de.dataAccess.ormDetected || de.dataAccess.parameterisedCount > 0) return true;
    if (de.logging.frameworkDetected || de.logging.rawConsoleLogCount > 0) return true;
    if (de.errorHandling.tryCatchCount > 0 || de.errorHandling.globalHandlerFound) return true;
    if (de.cryptography.strongAlgorithms.length > 0) return true;
    if (de.authorization.roleScopedCount + de.authorization.policyScopedCount + de.authorization.permissionCheckCount > 0) return true;
    return false;
  }
}
