# Phase 5 — Intelligence Features
## Formal Specification

---

## Objective

Implement the application's intelligence features using the KnowledgeModel as the sole source of truth. Every analysis page consumes structured knowledge and AI outputs from the model without performing additional repository analysis or maintaining duplicate data models.

Phase 5 is the application layer built on the platform established in Phases 1–4. No new core architecture is introduced. The intelligence engine, AI pipeline, SQLite data layer, and IPC contracts are all in place. Phase 5 completes the user-facing experience by ensuring every feature page reads from the KnowledgeModel and presents that information faithfully.

---

## Architectural Principles

**KnowledgeModel as the Only Data Source**
Every intelligence feature reads exclusively from the KnowledgeModel. No page re-parses source files, queries SQLite independently, or calls AI services directly.

**Capability-Aware Rendering**
Pages adapt to what the KnowledgeModel contains. Sections are gated by capability presence — not by workspace type. A folder analysis and a repository analysis both navigate to the same Architecture page; the page renders what the model provides.

**Reactive by Subscription**
Pages subscribe to `WorkspaceManagerService.activeWorkspace$`. When AI stages complete and results are merged into the workspace, pages update without any additional action.

**No Analysis in the Presentation Layer**
Pages present. They do not scan, parse, classify, or generate. Any information not already in the KnowledgeModel is absent from the page, not computed on demand.

**Shared Pages Across Workspace Types**
File, folder, and repository workspaces all navigate to the same seven shared capability pages. Conditional rendering within each page handles capability differences. There are no per-type page variants.

---

## Responsibility Split

### Angular (Phase 5 scope)
- Subscribing to `WorkspaceManagerService.activeWorkspace$` for live model updates
- Rendering KnowledgeModel data across seven shared capability pages
- Capability-gating page sections based on model content
- Assembling documentation through `DocumentationBuilderService`
- Exporting assembled documents through shared exporters

### Electron (unchanged from Phase 4)
- Generating and persisting the KnowledgeModel
- Running AI analysis stages and emitting results
- Serving knowledge through IPC

---

## Deliverables

---

### D1 — System Understanding

#### Description

Present a comprehensive overview of the analyzed artifact: what it is, how it is organized, and its primary purpose. Structural knowledge from the model is displayed alongside AI-generated narrative when available. The page updates reactively as the AI understanding stage completes.

#### Acceptance Criteria
- System understanding content is read exclusively from the KnowledgeModel
- Structural information (`structure`, `relationships`) and AI narrative (`ai.understanding`) are presented together
- The page supports file, folder, and repository workspaces
- The page performs no independent analysis
- Content updates automatically when `ai.understanding` is merged into the active workspace

---

### D2 — Architecture

#### Description

Present the architecture information contained in the KnowledgeModel: structural patterns, component relationships, and dependency hubs. Sections are gated by capability — file analyses display available structural data and gracefully omit sections that require multi-file context.

#### Acceptance Criteria
- Architecture data is read exclusively from the KnowledgeModel (`relationships.architecture`, `relationships.dependencies`)
- Sections requiring the `dependencyResolution` or `architectureDiscovery` capabilities are only rendered when those capabilities are present in the model
- Repository and folder analyses display richer architecture information when available
- File analyses render applicable sections and omit unsupported ones without error states
- No architecture detection occurs within the page

---

### D3 — Data Flow

#### Description

Present data flow information from the KnowledgeModel alongside AI explanations where available. The page visualizes the richest data available for the active workspace — a single-file data flow differs from a multi-file graph, and the page adapts accordingly.

#### Acceptance Criteria
- Data flow is read from `KnowledgeModel.insights.dataFlow`
- AI explanations supplement deterministic structural data; they do not replace it
- File, folder, and repository workspaces are all supported
- Missing capabilities are handled gracefully without error states
- No data flow analysis occurs within the page

---

### D4 — Security Intelligence

#### Description

Present security findings, risk assessments, and AI-generated security summaries from the KnowledgeModel. The page adapts to what the model contains — sections backed by absent capabilities are not shown.

#### Acceptance Criteria
- Security findings are read from `KnowledgeModel.ai.security`
- AI-generated security summaries are displayed from `KnowledgeModel.ai.securityOverview` when available
- Security sections are gated by capability presence
- The page performs no security analysis
- Security content updates automatically when AI stages complete and results are merged

---

### D5 — Recommendations

#### Description

Present prioritized improvement recommendations generated by AI from the KnowledgeModel. Each recommendation communicates its priority, rationale, and affected areas. The page updates reactively as the AI recommendations stage completes.

#### Acceptance Criteria
- Recommendations are read from `KnowledgeModel.ai.recommendations`
- Recommendations are rendered in priority order
- Supporting context (rationale, affected files, category) is displayed when present in the model
- The page performs no recommendation generation
- Recommendations update as AI results become available

---

### D6 — Learning Path

#### Description

Present a guided learning roadmap built from the KnowledgeModel that helps users understand the analyzed system. The roadmap adapts to the scope of the active workspace — a file learning path differs meaningfully from a repository-wide roadmap.

#### Acceptance Criteria
- Learning path content is read from `KnowledgeModel.ai.learningPath`
- The roadmap adapts to file, folder, and repository analyses through capability-aware rendering
- Learning steps reference structural knowledge from the model where available
- The page performs no independent analysis
- The learning path updates when the AI stage completes

---

### D7 — Documentation

#### Description

Assemble professional documentation from the KnowledgeModel using `DocumentationBuilderService` and export it through shared exporters. The builder reads from the model and produces a `DocumentModel`; the exporter consumes the `DocumentModel` and writes the output format. No additional analysis or AI generation occurs during assembly or export.

#### Acceptance Criteria
- Documentation is assembled exclusively from the KnowledgeModel via `DocumentationBuilderService`
- The builder produces a `DocumentModel`; exporters consume it — the two are decoupled
- Export to PDF is supported via `PdfExportService.exportFromModel(model, selectedIds)`
- Documentation adapts to available capabilities — sections backed by absent capabilities are excluded
- Exporting performs no repository analysis or AI generation

---

## Definition of Done

Phase 5 is complete when:

1. Every intelligence feature reads exclusively from the KnowledgeModel — no page performs analysis, parsing, or AI orchestration
2. All seven capability pages support file, folder, and repository workspaces through capability-aware rendering
3. Pages update reactively as AI stages complete and results are merged into the active workspace
4. Documentation is assembled from existing knowledge through `DocumentationBuilderService` and exported via `PdfExportService`
5. `RepositoryKnowledgeService`, `FileInventoryService`, and `RepositorySearchService` are removed — their responsibilities have been fully absorbed by the platform

---

## Deferred to Phase 6

The following are explicitly out of scope for Phase 5:

- Search rewire to use `WorkspaceManagerService` instead of `RepositoryKnowledgeService`
  *(prerequisite for removing `RepositoryKnowledgeService` — tracked in Phase 5 DoD item 5)*
- Incremental re-analysis triggers from the UI
- Multi-workspace comparison views
- Export formats beyond PDF

---

Generated by Rocket Flow · 2.0.20 · 2026-07-09
