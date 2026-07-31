# Security Page — LLM-Driven Findings: Full Implementation Plan

---

## 1. What This Change Is

The security page currently shows findings produced entirely by regex and graph heuristics. Severity is hardcoded, descriptions are boilerplate, and the detection has significant false positive problems. This change replaces the displayed findings with LLM-confirmed, LLM-reasoned output. The heuristic engine is kept — it becomes an evidence-gathering layer that feeds the LLM rather than a display layer. The LLM receives structured evidence, not raw source files, and returns a single JSON response containing everything the page needs.

---

## 2. End-to-End Process Flow

```
1. Structural analysis runs (unchanged)
   → model.structure.*, model.relationships.*, model.insights.*

2. Derive tier — intelligence:security IPC handler (changed)
   → SecurityEvidenceEngine.gatherEvidence(sourceFiles, dependencyGraph, targetType)
   → Produces SecurityEvidenceReport (structured evidence object, no findings yet)
   → Writes evidence to model.ai.security as a staging object
   → Does NOT produce findings, overallRisk, maturity, or next steps

3. Generate tier — LLMSummaryService (changed)
   → SecurityFindingsPromptBuilder.build(evidence, workspaceName, scope, languages)
   → Constructs a prompt with the evidence report as input
   → Calls ai:explain (existing IPC, unchanged)
   → LLM returns a single JSON string with:
       { postureSummary, findings[], verificationChecks[], overallRisk, securityMaturity }
   → SecurityFindingsPromptBuilder.parse(rawText) extracts the JSON
   → LLMSummaryService writes confirmed findings back to model.ai.security
   → LLMSummaryService writes postureSummary to model.ai.summaries.security

4. Security page reads:
   → model.ai.security.findings          (LLM-confirmed findings)
   → model.ai.security.verificationChecks (LLM-graded domain checks)
   → model.ai.security.overallRisk        (LLM-derived)
   → model.ai.security.securityMaturity   (LLM-derived)
   → model.ai.summaries.security          (postureSummary prose — for explanation card)
```

Without AI configured, `model.ai.security` has evidence only (no findings, no checks). The page shows the same "no provider" state as every other page's explanation card.

---

## 3. The LLM Response Schema

The LLM is instructed to return exactly this JSON structure:

```json
{
  "postureSummary": "string — 2-4 sentences contextualising the overall security posture",
  "overallRisk": "critical | high | medium | low",
  "securityMaturity": "Low | Medium | High",
  "findings": [
    {
      "id": "string",
      "title": "string",
      "severity": "critical | high | medium | low",
      "category": "secrets-management | authentication | authorization | input-validation | sql-injection | file-access | external-calls | configuration | cryptography",
      "fileName": "string",
      "filePath": "string",
      "lineStart": "number | null",
      "lineEnd": "number | null",
      "issueDescription": "string — what is wrong and where",
      "riskExplanation": "string — why this is exploitable and what the impact is",
      "remediation": "string — specific steps to fix this in the context of the detected stack"
    }
  ],
  "verificationChecks": [
    {
      "domain": "secrets | input-validation | authentication | authorization | data-access | logging | error-handling | cryptography",
      "status": "pass | warn | fail",
      "summary": "string — one sentence, what was checked and what was found",
      "detail": "string | null — only on warn/fail, what specifically is wrong or missing"
    }
  ]
}
```

Maximum 10 findings. Only domains relevant to the code appear in `verificationChecks` (LLM skips domains it has no evidence for). Findings are ordered severity descending. Checks are ordered: fail → warn → pass.

Findings reference candidate evidence by index. The prompt instructs the LLM to include a `candidateIndex` field (integer, 0-based) on each finding when it was derived from a specific candidate. The `parse()` method uses this to copy `lineStart` and `lineEnd` from the matching candidate into the finding — the LLM does not generate line numbers itself, it only selects which candidate it is confirming. For findings the LLM generates from domain evidence counts (not a specific candidate), `lineStart`/`lineEnd` remain null.

---

## 4. New Infrastructure

### 4.1 New File: `electron/main/engines/security/security-evidence.engine.js`

Replaces the detection role of `SecurityAnalysisEngine`. Gathers evidence per domain without making any pass/fail judgements.

**Public method:** `gatherEvidence(sourceFiles, dependencyGraph, targetType, languages)`

Returns a `SecurityEvidenceReport`:

```js
{
  scope: 'file' | 'folder' | 'repository',
  fileCount: number,
  languages: string[],
  candidates: CandidateFinding[],     // pattern hits with snippets
  domainEvidence: DomainEvidence,     // aggregated signals per domain
}
```

#### `CandidateFinding`
```js
{
  file: string,
  pattern: string,          // human label e.g. 'hardcoded-secret', 'sql-concat'
  snippet: string,          // extracted code context (function-scoped, up to 30 lines)
  lineStart: number,
  lineEnd: number,
  patternDescription: string  // e.g. 'password= assignment with string literal value'
}
```

#### `DomainEvidence` — one entry per domain

```js
{
  secrets: {
    envVarRefs: number,           // process.env, IConfiguration, GetEnvironmentVariable
    secretsManagerRefs: number,   // KeyVault, SecretManager, Vault, SSM
    hardcodedHits: number,        // SECRET_PATTERNS match count
    examples: CandidateFinding[]  // up to 2 examples
  },
  inputValidation: {
    frameworkDetected: string | null,  // 'FluentValidation', 'zod', 'joi', 'class-validator', etc.
    validationAttributes: number,      // [Required], [Range], [RegularExpression]
    guardClauseCount: number,          // if (!x) throw / ArgumentNullException patterns
    unvalidatedEntryPoints: number     // HTTP verb methods with no visible validation
  },
  authentication: {
    frameworkDetected: string | null,  // 'ASP.NET Identity', 'passport', 'JWT Bearer', etc.
    protectedSurfaces: number,         // [Authorize], requireAuth, @login_required
    unprotectedHttpVerbs: number,      // [HttpGet/Post/etc] with no auth decoration
    middlewareFound: boolean           // UseAuthentication, passport.initialize, etc.
  },
  authorization: {
    roleScopedCount: number,           // [Authorize(Roles=...)], IsInRole, HasRole
    policyScopedCount: number,         // [Authorize(Policy=...)], RequirePolicy
    presenceOnlyCount: number,         // [Authorize] with no role/policy
    permissionCheckCount: number       // HasPermission, CanAccess, custom checks
  },
  dataAccess: {
    ormDetected: string | null,        // 'EntityFramework', 'Dapper', 'TypeORM', 'Prisma', etc.
    parameterisedCount: number,        // SqlParameter, @param, ? placeholders
    concatenatedCount: number,         // SQL_INJECTION_PATTERNS match count
    storedProcedureCount: number       // EXEC sp_, ExecuteStoredProcedure
  },
  logging: {
    frameworkDetected: string | null,  // 'Serilog', 'NLog', 'winston', 'pino', etc.
    structuredLoggingUsed: boolean,    // template literals in log calls, not string concat
    sensitiveAdjacentCount: number,    // log calls near sensitive field names
    rawConsoleLogCount: number,        // console.log / Console.WriteLine in non-test files
    examples: CandidateFinding[]       // up to 2 examples of sensitive-adjacent hits
  },
  errorHandling: {
    tryCatchCount: number,
    emptyCatchCount: number,           // catch {} or catch (e) {} with no body
    globalHandlerFound: boolean,       // UseExceptionHandler, app.use((err,...)), process.on('uncaughtException')
    stackExposureCount: number         // .StackTrace, .stack, err.stack in response/log paths
  },
  cryptography: {
    strongAlgorithms: string[],        // AES, RSA, SHA256, SHA512, bcrypt, argon2, PBKDF2
    weakAlgorithms: string[],          // MD5, SHA1, DES, RC4, base64 (used as encryption)
    hardcodedIvOrKey: number,          // fixed IV=, key= near crypto calls
    examples: CandidateFinding[]       // up to 2 examples of weak algorithm hits
  }
}
```

#### Evidence gathering patterns (multi-language, first-match wins)

Each domain has pattern arrays covering the most common stacks. The engine scans every source file and accumulates counts. It does not decide whether counts are good or bad — that is entirely the LLM's job.

**Snippet extraction:** Unlike the current ±2 line `extractSnippet`, the new engine extracts **function-scoped context** — walks backward from the match to the nearest function/method declaration (`function `, `async `, `public `, `private `, `def `, etc.) and forward to the matching closing brace. Capped at 30 lines. This gives the LLM genuine context to reason about.

**Candidate cap:** `candidates[]` is capped at **15 entries** before the LLM call. Candidates are ranked by a confidence score computed at collection time:
- Exact credential patterns (raw JWT, bearer token, `password=` with string literal): score 100
- SQL concatenation in confirmed SQL context: score 80
- Weak cryptographic algorithm match: score 70
- Missing auth on HTTP verb: score 60
- Unsafe file operation with proximity signal: score 50
- Sensitive-adjacent log call: score 40
- Proximity-based signals (two unrelated signals in same file): score 20

Only the top 15 by score are included in the prompt. Domain evidence counts are always included in full — they are compact and do not grow with codebase size.

**`SecurityAnalysisEngine` replacement scope:** `SecurityEvidenceEngine` completely replaces `SecurityAnalysisEngine` for all scopes (file, folder, repository). The old engine is not called anywhere in the new pipeline. It is retained on disk as a reference (see `docs/heuristic-security-engine-reference.md`) but removed from `intelligence.ipc.js`. Hotspots are a confirmed cut — they were derived from heuristic findings and have no equivalent in the LLM-driven approach.

---

### 4.2 Modified File: `electron/main/ipc/intelligence.ipc.js`

The `intelligence:security` handler is simplified. It no longer calls `SecurityAnalysisEngine` for findings. It calls `SecurityEvidenceEngine` and returns the evidence report. The `SecurityNextStepsNarrativeEngine` call is removed.

```js
ipcMain.handle('intelligence:security', wrapHandler(async (_event, model) => {
  const sourceFiles = model.structure?.sourceCode
    ? [{ path: model.structure.filePath ?? 'file', content: model.structure.sourceCode }]
    : (model.relationships?.sourceFiles ?? []);
  const graph = model.relationships?.dependencies?.graph ?? null;
  const scope = model.targetType ?? 'repository';
  const languages = model.structure?.languages ?? [];

  const evidence = securityEvidence.gatherEvidence(sourceFiles, graph, scope, languages);

  // Return as the security AI result — findings/checks populated by generate tier later
  return {
    evidence,
    findings: [],
    verificationChecks: [],
    overallRisk: 'low',
    securityMaturity: 'High',
    generatedAt: new Date().toISOString(),
  };
}));
```

The returned object satisfies the `SecurityAnalysis` type with empty findings — the page handles this as "pending LLM confirmation".

---

### 4.3 New File: `src/app/ai/prompts/security-findings-prompt.ts`

Replaces `SecurityOverviewPromptBuilder` as the security prompt builder. It has two responsibilities: build the prompt and parse the response.

**`SecurityFindingsPromptBuilder`**

```ts
@Injectable({ providedIn: 'root' })
export class SecurityFindingsPromptBuilder {
  build(ctx: SecurityFindingsContext): string { ... }
  parse(raw: string): SecurityLLMResponse | null { ... }
}

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
  verificationChecks: SecurityVerificationCheck[];
}
```

The prompt instructs:
1. Persona — senior application security engineer
2. Task — analyse the evidence, confirm real findings, grade each security domain
3. Evidence block — the full `SecurityEvidenceReport` serialised as readable key-value pairs (not raw JSON — readable prose-style so the LLM reasons rather than just re-emits)
4. Output — "Respond with ONLY a valid JSON object matching this schema: ..." (schema inline)
5. Constraints — max 10 findings, only include verificationChecks for domains with evidence, findings ordered severity descending, no markdown wrapper around the JSON
6. Candidate referencing — "When a finding corresponds to a specific candidate, include `candidateIndex` (0-based integer) in the finding object. The line numbers will be taken from that candidate — do not generate line numbers yourself."
7. Verification check grading rules — explicitly stated in the prompt:
   - `pass`: positive signals present AND no negative signals detected for this domain
   - `warn`: domain appears relevant but positive signals are absent or coverage is incomplete (e.g. 11 of 14 entry points validated), OR evidence is thin and you cannot confirm compliance
   - `fail`: negative signals confirmed (hardcoded credential found, weak algorithm detected, etc.)
   - **Do not assign `pass` if you only found an absence of negative signals — absence of evidence is `warn`, not `pass`**

`parse()` finds the JSON block (handles models that wrap it in ```json...```), runs `JSON.parse`, validates top-level shape, returns null on any failure.

---

### 4.4 Modified File: `src/app/analysis/services/llm-summary.service.ts`

The `security` task in `_buildTasks` changes from using `SecurityOverviewPromptBuilder` to `SecurityFindingsPromptBuilder`. The key difference is what happens with the response.

A new private method `_generateSecurityAndMerge()` handles the security key specifically:

```ts
private async _generateSecurityAndMerge(
  workspaceId: string,
  model: KnowledgeModel,
  generation: number,
  provider: string,
  modelId: string,
): Promise<boolean> {
  const evidence = model.ai?.security?.evidence;
  if (!evidence) return false;

  const prompt = this.securityFindingsPrompt.build({
    workspaceName: model.workspaceName ?? 'Unknown',
    scope: model.targetType,
    languages: model.structure?.languages ?? [],
    evidence,
  });

  try {
    const raw = await this._withTimeout(this.electron.aiExplain(prompt), LLM_TIMEOUT_MS, 'security');
    const parsed = this.securityFindingsPrompt.parse(raw);

    if (parsed) {
      // Write confirmed findings back into model.ai.security
      this.ngZone.run(() => {
        this.manager.mergeAIResults({
          security: {
            ...model.ai!.security!,
            findings: parsed.findings,
            verificationChecks: parsed.verificationChecks,
            overallRisk: parsed.overallRisk,
            securityMaturity: parsed.securityMaturity,
          }
        }, 'security', generation);

        // Write posture summary to summaries.security (explanation card)
        this.manager.mergeSummaryKey(workspaceId, 'security', {
          content: parsed.postureSummary,
          status: 'complete',
          provider,
          model: modelId,
          generatedAt: new Date().toISOString(),
        }, generation);
      });
      return true;
    } else {
      // JSON parse failed — mark failed
      this.manager.markAIStageFailed(workspaceId, 'generate', generation, 'security-parse-failed');
      return false;
    }
  } catch (err) {
    // Timeout or network error
    this.manager.mergeSummaryKey(workspaceId, 'security', {
      content: '',
      status: 'failed',
      provider,
      model: modelId,
      generatedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }, generation);
    return false;
  }
}
```

`runAll` calls `_generateSecurityAndMerge` for the security key instead of `_generateAndMerge`.

---

### 4.5 Modified File: `src/app/analysis/models/security-analysis.model.ts`

Add new types:

```ts
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
```

Add to `SecurityFindingCategory`:
```ts
| 'cryptography'
```

Add to `SecurityAnalysis`:
```ts
verificationChecks?: SecurityVerificationCheck[];
evidence?: SecurityEvidenceReport;   // staging field — internal use only, not displayed
```

Add `SecurityEvidenceReport` interface mirroring the JS engine's output shape.

---

### 4.6 Modified File: `src/app/knowledge/models/knowledge-model.contract.ts`

No changes to `AIStage` — the security derive stage remains `'security'`, the generate stage remains `'generate'`. The security findings now flow through the generate tier rather than being set in the derive tier. This is already architecturally consistent — the derive tier sets `model.ai.security` with empty findings, the generate tier fills them in.

---

### 4.7 Modified Files: Security Page

`security-page.ts`, `security-page.html`, `security-page.scss` — see Section 6 (UI).

---

## 5. What Gets Removed

| What | Where | Why |
|---|---|---|
| `SecurityNextStepsNarrativeEngine` call | `intelligence.ipc.js` | Next steps now come from LLM inside each finding's `remediation` |
| `SecurityNextStepsNarrativeEngine` | `electron/main/engines/narrative/` | Replaced |
| Severity tabs | `security-page.html` | Not needed for ≤10 findings |
| Hotspots panel | `security-page.html` | Redundant with LLM findings |
| Next Steps panel | `security-page.html` | Folded into each finding card |
| `SecurityOverviewPromptBuilder` prose-only path | `llm-summary.service.ts` | Replaced by `SecurityFindingsPromptBuilder` |
| `SecurityHotspot`, `SecurityNextStep`, `SecurityRelevantComponent` | `security-analysis.model.ts` | No longer used in display |
| `deriveOverallRisk`, `deriveMaturity`, `deriveThemes`, `deriveSummary`, etc. | `security-analysis.engine.js` | LLM now derives these |

`SecurityAnalysisEngine` itself is NOT deleted — its pattern arrays and `gatherEvidence` logic are migrated into `SecurityEvidenceEngine`. The old engine file is kept for reference (matches the preservation doc).

---

## 6. UI — What the Security Page Shows

### Layout

Same overall shell: breadcrumb header, code panel for file scope (unchanged), file tree rail for folder/repo scope (unchanged). The `page-content` area changes.

### State machine

| State | Condition | What shows |
|---|---|---|
| No workspace | `!hasWorkspace` | Existing empty state |
| Analysis pending | `hasWorkspace && !security` | Existing pending state |
| Awaiting LLM | `security?.evidence && isGenerating && !isNoProvider` | Posture card shimmer + "AI is reviewing security evidence…" label; Findings card skeleton (3 placeholder rows); Verification checks card skeleton (4 placeholder rows) |
| No provider | `isNoProvider` | Posture card "AI not configured" state; Findings card hidden; Verification card hidden |
| LLM failed | `llmFailed` | Posture card error state with regenerate button; Findings card hidden; Verification card hidden |
| Complete | `llmSummaryEntry?.status === 'complete'` | Full page — all three panels populated |

**The "Awaiting LLM" state is critical.** Because findings only exist after the generate tier completes, users will see the page with evidence present but findings empty during generation. Without an explicit loading state this looks broken. The skeleton rows must be present and clearly labelled so the user understands analysis is in progress, not that no findings were found. The `isGenerating` flag (already bound to the `'generate'` AIStage) drives this state — no new state tracking needed.

### Panels (top to bottom)

**1. Security Posture card** (`app-explanation-card`)
Same component as today. Bound to `model.ai.summaries.security`. Shows the LLM-written `postureSummary`. Displays overall risk level and maturity as two small inline badges next to the title. Has the regenerate button. When generating: skeleton shimmer. When no provider: "AI not configured" state.

**2. Security Findings card**
Shown when `findings.length > 0`. Hidden entirely when LLM has not completed or returned no findings.

- No severity tabs. Simple ordered list — findings arrive already sorted critical → high → medium → low.
- Each finding is a card with a header row and an expandable body.
- **Header row:** severity badge (coloured) + category badge + title + caret
- **File reference row:** file icon + filename + line range (if present) — clicking this in file scope highlights the line in the code reader
- **Expanded body:**
  - "Issue" section — `issueDescription`
  - "Why It Matters" section — `riskExplanation`  
  - "Remediation" section — `remediation` (this replaces the separate next steps panel — specific, LLM-written, per-finding)
- Single-expand accordion (same as before)
- Line highlight + auto-scroll to code reader (same as before)
- Count badge in card header showing total findings

**3. Verification Checks card**
Always shown when LLM has completed (even if findings = 0). This is the panel that makes the page useful for clean codebases.

Title: "Security Verification". Subtitle: "Domains assessed based on detected patterns."

Layout: a compact checklist — one row per check. Each row:
- Status icon: ✓ (green, pass) / ⚠ (amber, warn) / ✗ (red, fail)
- Domain label (human-readable: "Secrets Management", "Input Validation", etc.)
- Summary text inline
- Expandable detail on warn/fail (click to expand, shows `detail` string)

Ordered: fail first, then warn, then pass. Pass rows are visually lighter (muted text, smaller). Fail/warn rows have a left border matching the severity colour.

When findings = 0 and all checks pass: the verification card shows all green — a meaningful "this codebase follows these security practices" confirmation. This is the utility for secure codebases.

**No-findings state when LLM complete:**
Instead of "No security findings detected" with nothing else, the page shows:
- The posture card (brief clean-bill summary)
- The verification checks card (all passes or minor warns)

This is always informative.

---

## 7. `maxTokens` for the Security Call

The current `ai:explain` path uses `AiKnowledgeEngine.explain()` which has `maxTokens: 2048`. This is insufficient for the JSON response.

**Token budget estimate for the security call:**
- Input: workspace header ~50 tokens + up to 15 candidates at ~150 tokens each (~2,250) + domain evidence block ~400 tokens + prompt instructions ~300 tokens = ~3,000 tokens input
- Output: postureSummary ~100 tokens + 10 findings at ~120 tokens each (~1,200) + 8 checks at ~60 tokens each (~480) = ~1,800 tokens output
- Total: ~4,800 tokens — comfortably within a 8,192 token context, but output alone exceeds the current 2,048 limit

`AiKnowledgeEngine.explain()` must accept an optional `maxTokens` override. Add an optional second parameter to `ElectronService.aiExplain()` and the `ai:explain` IPC handler for `maxTokens`, defaulting to `2048` for all existing callers. The security call passes `4096`.

---

## 8. Prompt Design Notes

The prompt evidence block should be **human-readable key-value pairs**, not raw JSON. This produces better reasoning from the LLM:

```
WORKSPACE: MyApp (repository, 47 files, C# / TypeScript)

CANDIDATE FINDINGS (heuristic pattern matches — confirm, refute, or adjust):
  1. [hardcoded-secret] UserRepository.cs:142
     Pattern: password= assignment with string literal value
     Snippet:
       private readonly string _connString = "Server=prod;Password=abc123;";

  2. [sql-concat] QueryBuilder.cs:87
     Pattern: string concatenation in SQL query context
     Snippet:
       var sql = "SELECT * FROM Users WHERE name = '" + userName + "'";

DOMAIN EVIDENCE:
  Secrets:
    - Environment variable references: 12 (process.env / IConfiguration)
    - Secrets manager references: 3 (Azure Key Vault)
    - Hardcoded credential pattern hits: 1 (see candidate #1)

  Input Validation:
    - Framework detected: FluentValidation
    - [Required]/[Range] attribute count: 23
    - Guard clause count (ArgumentNullException / if-null-throw): 14
    - Unvalidated HTTP entry points: 2

  Authentication:
    - Framework detected: ASP.NET Identity + JWT Bearer
    - [Authorize]-decorated surfaces: 31
    - Unprotected HTTP verb methods: 2
    - UseAuthentication middleware: found

  ... (remaining domains)
```

This format gives the LLM narrative context it can reason about, not just numbers. The instruction at the end: "Based on this evidence, return ONLY the JSON object described above. Confirm which candidate findings are real, assign accurate severity based on the full context, and grade each relevant security domain."

---

## 9. Implementation Order

### Phase 1 — Evidence Engine (backend, no UI change)
1. Write `SecurityEvidenceEngine` with all 8 domain evidence gatherers and function-scoped snippet extraction
2. Write unit tests against known code samples (C#, TypeScript minimum)
3. Update `intelligence:security` IPC handler to call `SecurityEvidenceEngine` instead of `SecurityAnalysisEngine`
4. Update `SecurityAnalysis` model to add `evidence` staging field and `verificationChecks`
5. Verify the derive stage still completes and `model.ai.security` is populated (with empty findings)

### Phase 2 — Prompt Builder + LLM Wiring (backend + service layer)
1. Write `SecurityFindingsPromptBuilder` with `build()` and `parse()`
2. Add `maxTokens` override to `aiExplain` IPC chain
3. Add `_generateSecurityAndMerge()` to `LLMSummaryService`
4. Wire into `runAll()` and `regenerate()`
5. Test end-to-end: run analysis on a C# repo with known issues, verify JSON is returned and parsed correctly, verify `model.ai.security.findings` and `model.ai.summaries.security` are both populated

### Phase 3 — UI (security page only)
1. Remove severity tabs, hotspots panel, next steps panel from template and component
2. Remove associated SCSS
3. Add verification checks panel with pass/warn/fail rows
4. Update findings card — remove tab filtering, add remediation section to expanded body
5. Add "awaiting LLM" intermediate state
6. Update `security-page.ts` getters and state logic

### Phase 4 — Cleanup
1. Remove `SecurityNextStepsNarrativeEngine` call from `intelligence.ipc.js`
2. Remove `SecurityOverviewPromptBuilder` (replace with `SecurityFindingsPromptBuilder`)
3. Remove unused types from `security-analysis.model.ts` (hotspot, relevant component, next step)
4. Remove `SecurityNextStepsNarrativeEngine` file
5. Run full TypeScript check — verify no compile errors

---

## 10. Risk and Fallback

**If LLM JSON parsing fails:** The page shows the explanation card in error state, the findings card is hidden, and the verification checks card is hidden. The posture card has a regenerate button. No crash, no broken UI.

**If the LLM returns findings the page can't display:** The `parse()` method validates the response shape and filters any finding missing required fields. Malformed findings are silently dropped — a partial result is better than nothing.

**If heuristic evidence is thin:** The LLM will produce fewer verification checks and may produce zero findings. This is correct behaviour — sparse evidence should produce honest "insufficient signal" results, not fabricated findings.

**Restoring heuristic findings:** See `docs/heuristic-security-engine-reference.md`. The `SecurityAnalysisEngine` files are not deleted. Reverting requires: restoring the `intelligence:security` handler, restoring the security page UI elements, and removing the evidence/LLM path from `LLMSummaryService`.

---

*Generated by Rocket Flow · 1.0.0 · 2026-07-29*
