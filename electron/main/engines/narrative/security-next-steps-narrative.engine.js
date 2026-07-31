/**
 * SecurityNextStepsNarrativeEngine — heuristic next-step list for the security page.
 *
 * Produces an ordered array of step objects from security findings without
 * calling an LLM. Steps are built conditionally from which finding categories
 * and severity levels are present, then sorted: immediate → high → recommended.
 *
 * Input shape:
 *   {
 *     findings:        SecurityFinding[],  // { severity, category, title, fileName }
 *     overallRisk:     string,             // 'critical' | 'high' | 'medium' | 'low'
 *     securityMaturity: string,            // 'Low' | 'Medium' | 'High'
 *     scope:           string,             // 'file' | 'folder' | 'repository'
 *     name:            string,             // workspace name
 *   }
 *
 * Output shape:
 *   Array<{
 *     priority: 'immediate' | 'high' | 'recommended',
 *     title:    string,    // ≤8 words
 *     detail:   string,    // 1-2 sentences specific to findings present
 *     category: string,    // finding category or 'general'
 *   }>
 */

class SecurityNextStepsEngine {

  build(data) {
    const { findings, securityMaturity } = data;

    if (!findings || findings.length === 0) {
      return [{
        priority: 'recommended',
        title: 'Validate with dedicated tooling',
        detail: 'No heuristic findings were detected, but static analysis has limited coverage. Run a dedicated SAST tool to confirm the absence of common vulnerabilities.',
        category: 'general',
      }];
    }

    const categories = findings.map(f => f.category);
    const hasSecrets       = categories.some(c => c === 'secrets-management');
    const hasSql           = categories.some(c => c === 'sql-injection');
    const hasAuth          = categories.some(c => c === 'authentication');
    const hasAuthz         = categories.some(c => c === 'authorization');
    const hasFileAccess    = categories.some(c => c === 'file-access');
    const hasConfig        = categories.some(c => c === 'configuration');
    const hasBroadAccess   = categories.some(c => c === 'broad-access');

    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount     = findings.filter(f => f.severity === 'high').length;

    const steps = [];

    // Always add if critical findings present
    if (criticalCount > 0) {
      steps.push({
        priority: 'immediate',
        title: 'Address critical findings immediately',
        detail: `${criticalCount} critical finding${criticalCount > 1 ? 's require' : ' requires'} remediation before this code is deployed. Critical vulnerabilities represent exploitable attack vectors with no mitigating controls.`,
        category: 'general',
      });
    }

    if (hasSql) {
      steps.push({
        priority: highCount > 0 || criticalCount > 0 ? 'immediate' : 'high',
        title: 'Replace string-concatenated queries',
        detail: 'All SQL built via string concatenation should be converted to parameterized queries. This is the only reliable mitigation for SQL injection — input sanitisation is not sufficient.',
        category: 'sql-injection',
      });
    }

    if (hasSecrets) {
      steps.push({
        priority: 'immediate',
        title: 'Remove hardcoded credentials',
        detail: 'Hardcoded secrets must be rotated and moved to environment variables or a secrets manager. Treat any exposed credential as compromised regardless of whether the file is public.',
        category: 'secrets-management',
      });
    }

    if (hasAuth) {
      steps.push({
        priority: 'high',
        title: 'Review authentication controls',
        detail: 'Authentication-related findings indicate the identity verification path has gaps. Review token validation, session expiry, and credential handling before exposing these endpoints.',
        category: 'authentication',
      });
    }

    if (hasAuthz) {
      steps.push({
        priority: 'high',
        title: 'Add explicit authorization to all endpoints',
        detail: 'Endpoints without authorization attributes are effectively public. Add authorization at the controller level and explicitly mark only intentionally public endpoints as anonymous.',
        category: 'authorization',
      });
    }

    if (hasFileAccess) {
      steps.push({
        priority: 'high',
        title: 'Sanitize file path inputs',
        detail: 'User-controlled file paths must be validated against an allowlist of permitted directories. Path traversal attacks require no special tooling — only an unsanitized path.',
        category: 'file-access',
      });
    }

    if (hasConfig) {
      steps.push({
        priority: 'recommended',
        title: 'Audit logging and configuration hygiene',
        detail: 'Sensitive values should never appear in log output. Review all log statements in security-sensitive files and implement field-level redaction for credentials, tokens, and PII.',
        category: 'configuration',
      });
    }

    if (hasBroadAccess) {
      steps.push({
        priority: 'recommended',
        title: 'Narrow security component interfaces',
        detail: 'Security-sensitive components with high inbound dependency counts increase blast radius. Introduce facades or narrow interfaces to limit what callers can access.',
        category: 'broad-access',
      });
    }

    // Always add at end
    steps.push({
      priority: 'recommended',
      title: 'Run dedicated security tooling',
      detail: `Heuristic analysis covers common patterns but is not exhaustive. ${securityMaturity === 'Low' ? 'Given the low maturity score, a full security audit is strongly recommended.' : 'Complement this analysis with Snyk, SonarQube, or a similar SAST tool for full coverage.'}`,
      category: 'general',
    });

    // Sort: immediate first, then high, then recommended
    const priorityOrder = { immediate: 0, high: 1, recommended: 2 };
    steps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return steps;
  }
}

module.exports = { SecurityNextStepsEngine };
