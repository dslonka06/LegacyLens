# Heuristic Security Engine — Reference Document

This document captures the complete implementation of the heuristic security analysis engine as it existed before the LLM-driven findings overhaul. It is a restoration reference — if the LLM approach is reverted, this document contains everything needed to bring the heuristic system back.

---

## Overview

The heuristic security engine ran entirely without AI. It walked every source file with regex patterns and graph algorithms, produced `SecurityFinding[]` with hardcoded severity levels, and wrote a `SecurityAnalysis` object into `model.ai.security`. The generate-tier LLM call then *interpreted* those heuristic findings as prose — it never discovered findings itself.

---

## Files Involved

| File | Role |
|---|---|
| `electron/main/engines/analysis/security-analysis.engine.js` | Compiled JS — the file that actually runs at runtime |
| `electron/main/engines/security/security-analysis.engine.ts` | TypeScript source — must be kept in sync with the JS manually |
| `electron/main/engines/narrative/security-next-steps-narrative.engine.js` | Heuristic next-steps builder (no LLM) |
| `electron/main/ipc/intelligence.ipc.js` | IPC handler that calls the engine and attaches next steps |
| `src/app/analysis/models/security-analysis.model.ts` | Angular model types |
| `src/app/features/analysis/pages/security-page/security-page.ts` | Page component that rendered the findings |
| `src/app/features/analysis/pages/security-page/security-page.html` | Template |
| `src/app/features/analysis/pages/security-page/security-page.scss` | Styles |
| `src/app/ai/prompts/security-overview-prompt.ts` | LLM prose prompt builder (read from heuristic findings) |

---

## Detection Patterns

### Secret Detection (`SECRET_PATTERNS`)

Nine regex patterns checked against raw file content. First match per file generates one finding (breaks after first hit).

```js
/password\s*=\s*["'][^"']{4,}/i
/apikey\s*=\s*["'][^"']{8,}/i
/api_key\s*=\s*["'][^"']{8,}/i
/connectionstring\s*=\s*["'][^"']{12,}/i
/server\s*=\s*\w+;.*password\s*=/i
/secret\s*=\s*["'][^"']{4,}/i
/privatekey\s*=\s*["'][^"']{8,}/i
/bearer\s+[a-zA-Z0-9\-._~+/]+=*/i
/eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_+/=]*/  // raw JWT
```

**Severity:** Always `high`. **Category:** `secrets-management`.

Known limitation: fires on test files with fake credentials. No context weighting.

### SQL Injection (`SQL_INJECTION_PATTERNS`)

Nine patterns. Only fires when the file also contains SQL keywords (`select`, `insert`, `update`, `delete`, `execute`, `sqlcommand`, `dbcommand`, `query`).

```js
/\+\s*["']?\s*\w*\s*\+/         // generic string concatenation
/string\.format.*select/i
/execute\s*\(.*\+/i
/sql\s*=.*\+\s*\w/i
/query\s*=.*\+\s*\w/i
/"select.*"\s*\+/i
/"insert.*"\s*\+/i
/"update.*"\s*\+/i
/"delete.*"\s*\+/i
```

**Severity:** Always `high`. **Category:** `sql-injection`.

Known limitation: the generic concatenation pattern `/\+\s*["']?\s*\w*\s*\+/` fires on any `a + b + c` expression. High false positive rate on non-SQL files that happen to mention "query".

### Unsafe File Operations

Single pattern: `/File\.(WriteAll|Create|Open|Copy|Move)/i`

Only fires when the same file also matches `/Request\.|input\.|param\./i`. The two signals are checked independently — they can be anywhere in the file, not co-located.

**Severity:** `medium`. **Category:** `file-access`.

Known limitation: proximity check is file-wide, not function-scoped. A file that imports `HttpContext` anywhere and also has a `File.Create` call will always fire.

### Missing Authorization

Pattern: `/\[(HttpGet|HttpPost|HttpPut|HttpDelete)\]/i`

Only fires when the file contains `Controller` or `controller`, and does NOT contain `[Authorize]` or `[AllowAnonymous]`.

**Severity:** `high`. **Category:** `authorization`.

Known limitation: only checks for `[Authorize]` at the file level. Does not account for attribute inheritance, custom auth filters, middleware-based auth, or minimal API patterns. Non-ASP.NET HTTP handlers will always fire.

### Sensitive Data in Logs

Pattern: `/log\.(info|warn|error|debug|trace|write)/i`

Only fires when the same file also matches `/password|secret|token|ssn|creditcard|credit_card/i`.

**Severity:** `medium`. **Category:** `configuration`.

Known limitation: same file-wide proximity issue — a logging utility that also imports a `TokenService` will fire even if it never logs token values.

---

## Graph-Based Findings (Folder/Repository Scope Only)

### Broadly Exposed Security Components

For every node in the dependency graph, if:
- the node name matches a sensitive name pattern (see below), AND
- inbound dependency count ≥ `HIGH_COUPLING_THRESHOLD` (10)

A finding is generated. Severity is `high` if inbound ≥ 20, otherwise `medium`. **Category:** `broad-access`.

Known limitation: high inbound coupling on a shared `AuthService` is expected design, not a vulnerability. This generated false findings on any well-architected app.

### Circular Dependencies Involving Security Nodes

If any node in a detected dependency cycle has a sensitive name, one finding is created covering all such cycle members. **Severity:** `medium`. **Category:** `authentication` (was incorrectly categorized — should have been `architecture`).

---

## Sensitive Name Patterns

Used both for marking files as "security-relevant components" and for graph-based findings.

```js
['auth', 'oauth', 'jwt', 'token', 'secret', 'password', 'credential',
 'permission', 'role', 'claim', 'identity', 'session', 'encrypt',
 'decrypt', 'hash', 'salt', 'security', 'privilege']
```

---

## `SecurityFinding` Model Fields

```ts
interface SecurityFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  fileName: string;
  filePath?: string;
  lineStart?: number;       // added in the line-highlight pass
  lineEnd?: number;         // added in the line-highlight pass
  codeSnippet?: string;
  issueDescription: string;
  riskExplanation: string;
  remediation: string;
  affectedComponents: string[];
  affectedWorkflows: string[];
}
```

`lineStart`/`lineEnd` are populated by `extractSnippet()` — a ±2 line window around the regex match index. Not all finding types extracted line numbers at the time of removal; secrets and SQL injection did, the remaining three types had been recently updated to also extract them.

---

## `SecurityAnalysis` Model Shape

```ts
interface SecurityAnalysis {
  executiveSummary: string;
  summary: string;
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  securityMaturity: 'Low' | 'Medium' | 'High';
  maturityContext: string;
  riskContext: string;
  findings: SecurityFinding[];
  hotspots: SecurityHotspot[];
  relevantComponents: SecurityRelevantComponent[];
  recommendationThemes: string[];
  readinessAssessment: string;
  nextSteps?: SecurityNextStep[];       // added by SecurityNextStepsNarrativeEngine
  generatedAt: string;
}
```

---

## `SecurityNextStepsNarrativeEngine`

File: `electron/main/engines/narrative/security-next-steps-narrative.engine.js`

Pure conditional-push pattern (no `NarrativeCondition` clusters). Receives:
```js
{ findings, overallRisk, securityMaturity, scope, name }
```

Derives boolean flags from finding categories: `hasSql`, `hasSecrets`, `hasAuth`, `hasAuthz`, `hasFileAccess`, `hasConfig`, `hasBroadAccess`. Counts critical findings.

Pushes `SecurityNextStep` objects conditionally, always appends a "run dedicated security tooling" recommended step, then sorts by priority (`immediate` → `high` → `recommended`).

Output: `SecurityNextStep[]` — attached to `result.nextSteps` inline in the `intelligence:security` IPC handler.

---

## `overallRisk` Derivation

```js
deriveOverallRisk(findings) {
  if (findings.some(f => f.severity === 'critical')) return 'critical';
  if (findings.some(f => f.severity === 'high'))     return 'high';
  if (findings.some(f => f.severity === 'medium'))   return 'medium';
  if (findings.length > 0)                           return 'low';
  return 'low';
}
```

`overallRisk` is the highest severity of any finding. Critically: heuristic findings never produced `critical` severity — the highest any pattern could produce was `high`. So `overallRisk` was at most `high` in all heuristic runs.

---

## `securityMaturity` Derivation

```js
deriveMaturity(findings) {
  const critical = findings.filter(f => f.severity === 'critical').length;
  const high     = findings.filter(f => f.severity === 'high').length;
  if (critical > 0 || high >= 3) return 'Low';
  if (high >= 1 || findings.length >= 3) return 'Medium';
  return 'High';
}
```

Three levels: `Low`, `Medium`, `High`. Since no finding was ever `critical`, maturity was `Low` when ≥3 high findings, `Medium` when 1-2 high findings or ≥3 total, `High` otherwise.

---

## UI: Security Page Finding Display

The security page rendered findings in a **severity tab + single-expand accordion** layout.

### Severity tabs
`SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']`

Each tab showed a count badge. Selecting a tab filtered the findings list. Tabs with no findings had a dimmed "empty" style. On workspace change, `_resetToHighestTab()` auto-selected the first severity with findings.

### Finding accordion
Clicking a finding row expanded it (single-expand — only one open at a time). Collapse re-ran if the same row was clicked. An expanded finding that had `lineStart`/`lineEnd` set would pass `highlightLines` to the code reader, triggering amber highlight and auto-scroll.

### Category badges
The `categoryLabel()` method on the page component mapped category slugs to human-readable labels:
```ts
'sql-injection' → 'SQL Injection'
'secrets-management' → 'Secrets Management'
'authorization' → 'Authorization'
'authentication' → 'Authentication'
'input-validation' → 'Input Validation'
'file-access' → 'File Access'
'configuration' → 'Configuration'
'broad-access' → 'Broad Access'
'ai-finding' → 'AI Finding'
```

### Next Steps panel
Rendered below the findings card when `security.nextSteps?.length > 0`. Each step had a priority-colored left border:
- `immediate` → critical color (`--security-critical`)
- `high` → high color (`--security-high`)
- `recommended` → accent color (`--accent`)

### Code reader integration
The security page used `app-code-editor` with `[highlightLines]` input. `toggleFinding()` set `this.highlightLines` from `finding.lineStart`/`lineEnd` when the finding was in file scope and had line numbers. The code editor had a `scrollToHighlightedLine()` method using a 50ms `setTimeout` then `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

---

## What to Restore

To restore the full heuristic system:

1. The engine files themselves were never deleted — `security-analysis.engine.js` and `.ts` still contain all detection logic. The `SecurityNextStepsNarrativeEngine` is also still present.

2. The security page component, template, and SCSS will have been modified — restore the following from git history:
   - Severity tab rendering
   - Finding accordion with `toggleFinding()`, `expandedFindingId`, `highlightLines`
   - `categoryLabel()` method
   - `hasNextSteps` getter
   - Next Steps panel template block
   - SCSS for `.sec-tab`, `.sec-tab--active`, `.sec-tab--empty`, `.sec-finding-card`, `.sec-cat-badge`, `.sec-step--immediate`, `.sec-step--high`, `.sec-step--recommended`

3. The `model.ai.security.findings` array must be re-wired as the display source. In the LLM-findings approach, findings come from the confirmed LLM output. Restoring means pointing the template back at `this.security?.findings` directly.

4. The `intelligence:security` IPC handler needs the `securityNextSteps.build()` call restored if it was removed.

---

*Generated by Rocket Flow · 1.0.0 · 2026-07-29*
