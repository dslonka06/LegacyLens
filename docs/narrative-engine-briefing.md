# Narrative Engine Briefing — SystemLens

This document is a complete briefing for building new narrative engines in SystemLens. It covers the two engine patterns in use, how engines plug into the pipeline, what data is available, and the specific context of the learning path page that needs revamping.

---

## What Narrative Engines Are

Narrative engines are pure JavaScript functions/classes in `electron/main/engines/narrative/` that transform structured data (numbers, arrays, flags) into human-readable strings — without calling an LLM. They run during the **derive tier** of the AI pipeline, before the LLM generate tier fires.

The output of narrative engines feeds two consumers:
1. **Directly into the UI** — some narrative strings are rendered as-is on analysis pages (e.g. data flow step descriptions, hub narrative sentences)
2. **Into LLM prompts** — the generate-tier prompt builders read narrative strings and embed them as context for the LLM to interpret and expand

Narrative engines must be:
- **Deterministic** — same input always produces same output
- **Condition-driven** — different data states must produce structurally different sentences, not the same template with swapped values
- **Self-contained** — no async, no I/O, no external dependencies beyond what is passed in

---

## The Two Engine Patterns

### Pattern A — NarrativeCondition / Cluster (weighted selection)

Used by: `HubNarrativeEngine`, `BusinessPurposeNarrativeEngine`, `CodeHealthNarrativeEngine`

The engine defines arrays of `NarrativeCondition` objects. Each condition has a weight, a `when` predicate, and a `produce` function:

```js
{
  weight: 150,
  when: (d) => d.complexity === 'high' && d.riskCount >= 3,
  produce: (d) => `${d.name} carries high cyclomatic complexity and multiple flagged risks, suggesting accumulated technical debt.`
}
```

A `_pick(conditions, data)` helper filters conditions whose `when` returns true, sorts by weight descending, and calls `produce` on the highest-weight match. Multiple sentence slots are assembled and joined:

```js
_pick(conditions, data) {
  const matches = conditions.filter(c => c.when(data)).sort((a, b) => b.weight - a.weight);
  return matches.length ? matches[0].produce(data) : '';
}

build(data) {
  const sentence1 = this._pick(this._roleConditions, data);
  const sentence2 = this._pick(this._metricsConditions, data);
  const sentence3 = this._pick(this._structuralConditions, data);
  return [sentence1, sentence2, sentence3].filter(Boolean).join(' ');
}
```

**When to use Pattern A:** When the narrative has multiple independent sentence slots, each of which should say qualitatively different things based on data thresholds. Good for health summaries, role descriptions, and any prose that needs to vary structurally — not just fill in different numbers.

**Key rule:** Conditions with higher weights represent more specific/severe states. Lower weights are broader fallbacks. A weight-1 condition is the catch-all. Always have a fallback.

---

### Pattern B — Keyword Cluster / conditional push

Used by: `ResponsibilitiesNarrativeEngine`, `DataFlowStepsNarrativeEngine`, `DataFlowPatternEngine`, `SecurityNextStepsEngine`

The engine defines a `CLUSTERS` or `RULES` array. Each cluster has keyword arrays and a `describe()` or `produce()` function. The engine scans the input text for the first cluster whose keywords match, then calls that cluster's function:

```js
const CLUSTERS = [
  {
    name: 'auth',
    keywords: ['login', 'authenticate', 'token', 'jwt', 'session', 'credential'],
    describe: (step, i, steps, d) =>
      `This step handles authentication: ${step}. It verifies the caller's identity before allowing access to protected resources.`
  },
  // ... more clusters
];

build(data) {
  const text = [...data.steps, ...data.inputs, ...data.outputs].join(' ').toLowerCase();
  const cluster = CLUSTERS.find(c => c.keywords.some(k => text.includes(k))) ?? CLUSTERS_FALLBACK;
  return data.steps.map((step, i) => cluster.describe(step, i, data.steps, data));
}
```

`SecurityNextStepsEngine` is a variant — it doesn't scan keywords but instead derives boolean flags from finding categories and pushes step objects conditionally:

```js
build(data) {
  const steps = [];
  const hasSql = data.findings.some(f => f.category === 'sql-injection');
  if (hasSql) steps.push({ priority: 'immediate', title: 'Eliminate SQL Injection', detail: '...' });
  // ... more conditions
  steps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return steps;
}
```

**When to use Pattern B:** When the narrative is list-driven (one item per input element) or when the output is a structured array rather than a prose paragraph. Good for step-by-step descriptions, action item lists, and any output where each input element gets its own narrative treatment.

---

## The Full Pipeline — Where Engines Fit

```
Structural analysis (code parsing, graph building)
    ↓ writes model.structure.*, model.relationships.*, model.insights.*

Derive tier (concurrent — all fire at once via Promise.all in ai-analysis.service.ts):
  intelligence:understanding  → SystemUnderstandingEngine
                               + HubNarrativeEngine (structural pass)
                               + BusinessPurposeNarrativeEngine
                               + CodeHealthNarrativeEngine
                               + ResponsibilitiesNarrativeEngine (file scope)
  intelligence:security       → SecurityAnalysisEngine
                               + SecurityNextStepsNarrativeEngine
  intelligence:recommendations → RecommendationAnalysisEngine
  intelligence:dataFlow        → DataFlowAnalysisEngine
                               + DataFlowPatternEngine (file scope)
                               + DataFlowStepsNarrativeEngine (file scope)
  intelligence:architecture    → ArchitectureAnalysisEngine (folder/repo only)
  intelligence:learningPath    → LearningPathAnalysisEngine

After derive tier completes:
  intelligence:hubDirective   → HubNarrativeEngine (directive pass — reads security + recommendations)

Generate tier (LLM calls — one per page):
  ai:explain × N              → LLM reads derived data + narratives → writes summaries.*
```

Narrative engines run **inside the derive-tier IPC handlers** (in `intelligence.ipc.js`), not as separate stages. They augment the engine result before it is returned to Angular.

---

## Data Available at Derive Time

When a narrative engine runs (inside an IPC handler), the full `KnowledgeModel` has been passed in. The `adaptModelForEngines()` shim translates it to the legacy `{knowledge, session}` shape that the older engines expect.

**For all scopes, available from `model`:**
- `model.targetType` — `'file' | 'folder' | 'repository'`
- `model.workspaceName`
- `model.structure.languages[]`, `.frameworks[]`, `.technologies[]`, `.totalFiles`
- `model.insights.complexity` — `'low' | 'medium' | 'high'`
- `model.insights.maintainability` — `'low' | 'medium' | 'high'`
- `model.insights.riskCount` — integer
- `model.relationships.architecture.patterns[]` — `{ name, description, confidence }[]`
- `model.relationships.dependencies.graph` — `{ nodes: [], edges: [] }`

**For folder/repository scope, additional:**
- `knowledge.sourceFiles[]` — `{ path, content, language }[]`
- `knowledge.dependencyGraph` — same as above, legacy shape

**For file scope, additional:**
- `session.analysis.language`, `.type`, `.complexity`, `.maintainability`
- `session.analysis.responsibilities[]`, `.inputs[]`, `.outputs[]`, `.flowSteps[]`
- `session.analysis.risks[]` — `{ description, severity }[]`
- `model.structure.symbols` — parsed class/method names

**After `understanding` stage completes (available to `learningPath`):**
- `model.ai.understanding.executiveSummary`
- `model.ai.understanding.businessPurpose`
- `model.ai.understanding.keyAreas[]`
- `model.ai.understanding.systemType`
- `model.ai.understanding.businessCriticality`
- `model.ai.understanding.responsibilityGroups[]`
- `model.ai.understanding.coreCapabilities[]`

The `learningPath` stage is intentionally run after the concurrent derive batch in the Angular pipeline (`ai-analysis.service.ts`) so it always has `understanding` populated. This is the only derive stage with a guaranteed ordering dependency.

---

## How to Wire a New Narrative Engine

### 1. Create the engine file

```js
// electron/main/engines/narrative/my-new-narrative.engine.js

class MyNewNarrativeEngine {
  build(data) {
    // data = whatever shape you define
    // return a string, string[], or structured object
  }
}

module.exports = { MyNewNarrativeEngine };
```

### 2. Instantiate it in `intelligence.ipc.js`

At the top of the file alongside the other narrative engine requires and instantiations:

```js
const { MyNewNarrativeEngine } = require('../engines/narrative/my-new-narrative.engine');
// ...
const myNewNarrative = new MyNewNarrativeEngine();
```

### 3. Call it inside the relevant IPC handler

Inside the handler that manages the stage this narrative augments, call it after the primary engine and attach the result to the return object:

```js
ipcMain.handle('intelligence:learningPath', wrapHandler(async (_event, model) => {
  const { knowledge, session } = adaptModelForEngines(model);
  const understanding = model.ai?.understanding ?? null;
  const scope = model.targetType ?? 'repository';

  const result = knowledge
    ? learningPath.analyzeKnowledge(knowledge, session, understanding, scope)
    : learningPath.analyzeFile(session, understanding);

  // Add narrative engine output to the result
  result.someNarrativeField = myNewNarrative.build({
    scope,
    roadmap: result.roadmap,
    // ... whatever the engine needs
  });

  return result;
}));
```

### 4. Update the TypeScript model type

Add the new field to the relevant model in `src/app/analysis/models/` or `src/app/knowledge/models/`. For learning path, that is `src/app/analysis/models/learning-path-analysis.model.ts`.

### 5. The Angular service writes it automatically

`WorkspaceKnowledgeService` writes the full IPC response into `model.ai.learningPath` (or whichever AI field the stage maps to). Any new fields in the returned object land in the model automatically as long as the TypeScript type is updated.

---

## The Learning Path Page — Current State and What Needs Revamping

### What is currently rendered

The template renders three data sources from `model.ai.learningPath`:

1. **`lp.roadmap`** — `LearningStep[]`. Each step has `stepNumber`, `title`, `goal`, `whyItMatters`, `recommendedFiles[]`, `recommendedFolders[]`, `checkpoints[]`, `whereToNext`. Displayed as a vertical collapsible list in the left column.

2. **`lp.keyConcepts`** — `KeyConcept[]`. Each concept has `name`, `plainEnglishDefinition`, `whyItMatters`, `whereItAppears`. Displayed as a flat list in the right sidebar column.

3. **`lp.nextSteps`** — `NextStepLink[]`. A 2-column grid of navigation cards at the bottom of the left column.

4. **`model.ai.summaries.learningPath`** — the LLM prose summary shown in the `app-explanation-card` above the body.

### What the engine produces but the page does NOT currently render

- `lp.welcomeTitle` — personalised heading for the page
- `lp.welcomeSummary` — 1-2 sentence intro paragraph
- `lp.focusFirst` — a single recommended starting point
- `lp.systemAreas[]` — area breakdown (name, description, fileCount, role)
- `lp.suggestedReadingOrder[]` — ordered file list with reason per file
- `lp.ignoreForNow[]` — files/areas explicitly deprioritised for new readers

These fields are populated by the engine and present in the model but are wired to nothing in the template.

### `LearningStep` full shape

```ts
{
  stepNumber: number;
  title: string;
  goal: string;
  whyItMatters: string;
  recommendedFiles: string[];
  recommendedFolders: string[];
  checkpoints: string[];
  whereToNext: string;
}
```

### `LearningPathAnalysis` full shape

```ts
{
  scope: 'file' | 'folder' | 'repository';
  welcomeTitle: string;
  welcomeSummary: string;
  systemType: string;
  focusFirst: string;
  roadmap: LearningStep[];
  keyConcepts: KeyConcept[];
  systemAreas: SystemArea[];
  suggestedReadingOrder: SuggestedReadingItem[];
  ignoreForNow: IgnoreForNow[];
  nextSteps: NextStepLink[];
  generatedAt: string;
}
```

### How `LearningPathAnalysisEngine` currently works

The engine (`electron/main/engines/analysis/learning-path.analysis.engine.js`) receives the `knowledge`, `session`, `understanding`, and `scope` arguments from the IPC handler.

For **folder/repository scope**, `analyzeKnowledge()`:
- Derives `systemType` from architecture patterns and file counts
- Builds `roadmap` steps: one step per major concern area (security, data, API surface, architecture, etc.) based on what the understanding stage found
- Builds `keyConcepts` from `understanding.keyAreas` cross-referenced against file names and symbols
- Builds `nextSteps` as hard-coded navigation links to other analysis pages (`/repository-analysis/security`, etc.)

For **file scope**, `analyzeFile()`:
- Much simpler — builds 1-3 roadmap steps from the file's responsibilities
- Key concepts come from the method/class names in `session.analysis`

The engine currently has no dedicated narrative engines of its own — it builds its strings directly in the engine logic using template literals and conditionals. This is the pattern the revamp should move away from.

### What the revamp should aim for

The goal is to make the learning path page richer and more useful to a developer trying to understand an unfamiliar codebase. Consider:

- **`WelcomeNarrativeEngine`** — builds a personalised `welcomeTitle` and `welcomeSummary` using Pattern A (NarrativeCondition), varying by `systemType`, `scope`, and `complexity`
- **`LearningRoadmapNarrativeEngine`** — enriches each `LearningStep` with a more descriptive `whyItMatters` and `goal` using Pattern A conditions keyed on the step's domain (security step vs. data model step vs. API surface step)
- **`ReadingOrderNarrativeEngine`** — builds step-by-step reading order descriptions using Pattern B (keyword cluster), similar to `DataFlowStepsNarrativeEngine` — one description per file in `suggestedReadingOrder`
- **`KeyConceptNarrativeEngine`** — enriches `plainEnglishDefinition` per concept using Pattern B clusters keyed on technology/pattern name (e.g. "JWT" cluster, "Repository pattern" cluster, "Dependency injection" cluster)

Each of these would be called inside the `intelligence:learningPath` IPC handler after `learningPath.analyzeKnowledge()` returns, and their output would replace or augment the corresponding fields in the result before it is returned.

### Fragile pattern to be aware of: `fixedRoute()`

The `LearningPathAnalysisEngine` hard-codes route prefixes in `nextSteps` links (e.g. `/file-analysis/security`). The page component rewrites them at render time via `fixedRoute()` to match the actual workspace type. This coupling between the engine and the routing layer is fragile and should be refactored — the engine should produce route keys (`'security'`, `'dataFlow'`) and the component should resolve the full path.

### Important dependency: `understanding` must be available

The `learningPath` stage is called after the concurrent derive batch so `model.ai.understanding` is always populated when it runs. Any new narrative engines for learning path can safely read from `understanding` — pass it through to the engine as a parameter.

---

## `LLMSummaryKey` and the Generate Tier

The LLM prose card on the learning path page reads from `model.ai.summaries.learningPath` (type `LLMSummaryEntry`). This is populated by the generate tier via `LLMSummaryService` calling the `LearningPathOverviewPromptBuilder`.

New narrative engine output that should influence the LLM prose should be included in the data that the prompt builder reads. The prompt builder reads from the fully-derived `model.ai.learningPath` — so any new fields added to `LearningPathAnalysis` and populated by narrative engines will be available to the prompt builder automatically, as long as the `SecurityOverviewContext` (or equivalent `LearningPathOverviewContext`) type is updated to include them.

---

*Generated by Rocket Flow · 1.0.0 · 2026-07-29*
