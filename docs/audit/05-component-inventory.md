# Component Inventory

Audit of all components under `src/app/components/`. Importer counts are derived from static import analysis across the full source tree.

---

## 1. Full Inventory

| Component | Purpose | Importers | Status |
|-----------|---------|:---------:|--------|
| `AnalysisPanel` | Displays pattern-based and AI-enriched analysis results (summary, business purpose, complexity, maintainability, risks, modernization suggestions) for a single file session. | 1 | single-use |
| `CodeEditor` | Monaco-backed editor handling file/folder upload, language detection, workspace classification, and both pattern-based and AI analysis pipelines. | 3 | reused |
| `ExplanationCard` | Renders an AI-generated explanation block with title, multi-paragraph content, loading state, error state, and dismiss action. | 3 | reused |
| `GlobalSearch` | Debounced, keyboard-navigable global search bar querying the repository search index and routing to matching files, folders, workflows, or the repository navigation page. | 0 | unused |
| `RepositoryCallout` | Compact summary callout (project count, file count, detected technologies) for the current workspace with a link to the repository analysis page. | 0 | unused |
| `RepositoryIntelligence` | Dependency graph summary and ranked key components (system hubs, widely-used files, broad-scope orchestrators) from the repository knowledge model. | 0 | unused |
| `RepositoryPreview` | Depth-limited file tree and project list from a `WorkspaceProfile` giving a visual overview of the uploaded repository or folder structure. | 0 | unused |
| `ResizeDividerComponent` | Drag handle emitting pixel-width changes for the panel to its left, enforcing configurable minimum widths on both sides of a split. | 6 | reused |
| `Sidebar` | Application-level navigation sidebar rendering context-aware links based on the active workspace type with collapse toggling. | 1 | single-use |
| `WorkspacePanel` | Shows active workspace name, type, and status with actions to rename, delete, create, or open the workspace switcher modal. | 3 | reused |
| `WorkspaceSummary` | Displays the classified workspace type label and classification confidence percentage from a `WorkspaceProfile`. | 0 | unused |
| `WorkspaceSwitcherModal` | Modal overlay listing all open workspaces with activate/delete options and a limit-reached message at the maximum workspace count. | 3 | reused |

---

## 2. Reused Components

These components are shared across multiple features and represent the healthy shared layer of the UI.

| Component | Importers | Notes |
|-----------|:---------:|-------|
| `ResizeDividerComponent` | 6 | Most widely used component in the codebase. Pure interaction primitive with no domain logic. Used by all three analysis pages and all three documentation pages. |
| `CodeEditor` | 3 | Carries significant orchestration logic (workspace classification, knowledge pipeline, AI analysis) beyond a pure editor wrapper. `readOnly` and `hideFolderUpload` inputs allow per-page customisation. Worth considering whether the orchestration responsibilities should be extracted from the editor primitive. |
| `ExplanationCard` | 3 | Pure presentational component with no service dependencies. Used identically across all three system-understanding pages. No concerns. |
| `WorkspacePanel` | 3 | Used by all three analysis pages. Always co-imported with `WorkspaceSwitcherModal`. |
| `WorkspaceSwitcherModal` | 3 | Always imported together with `WorkspacePanel`. The `limitReached` input changes header copy but not list behaviour. |

---

## 3. Single-Use Components

These components have exactly one importer. That is not automatically a problem, but each should be evaluated for whether it belongs in the shared `components/` folder or should move into the feature folder it serves.

| Component | Sole Importer | Recommendation |
|-----------|--------------|----------------|
| `AnalysisPanel` | `file-analysis-page` | The folder and repository analysis pages do not use this panel; they have their own layouts. Moving it into the `file-analysis` feature folder would make the ownership explicit and reduce the apparent surface area of shared components. |
| `Sidebar` | `app.ts` (root shell) | Single-use by design as a global layout element. No action required — it belongs in `components/` as a shell-level primitive. |

---

## 4. Unused Components — High Confidence Removal Candidates

None of the following components are imported anywhere in the codebase. They are candidates for deletion unless there is a confirmed roadmap item that will wire them up imminently.

| Component | Why It Is Unused | Risk if Removed |
|-----------|-----------------|-----------------|
| `GlobalSearch` | Not wired into the sidebar or header shell despite depending on `RepositorySearchService` and `NavigationContextService`, which are live services. | Low — deleting the component does not affect those services. Re-creating it later is straightforward given the services already exist. |
| `RepositoryCallout` | Orphaned. Likely a candidate for embedding in analysis pages or the sidebar, but has never been connected. | Low — pure display component with no side effects. |
| `RepositoryIntelligence` | Self-contained with its own build-progress indicator; likely intended for repository or folder analysis pages but never connected. | Low — removing it does not affect the analysis pages, which already have their own intelligence panels. |
| `RepositoryPreview` | May have been superseded by inline tree rendering within the current analysis page layouts. Pure display component with no service dependencies. | Low — no callers exist and no services depend on it. |
| `WorkspaceSummary` | Lightweight presentational component likely replaced by the richer `WorkspacePanel` in current page layouts. | Low — `WorkspacePanel` already covers its use case. |

> **Recommended action:** open a single clean-up task to delete all five unused components in one commit. Verify with a global import search before deletion to rule out any dynamic or lazy-loaded references not captured in static analysis.
