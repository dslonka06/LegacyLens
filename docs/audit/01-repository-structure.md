# 01 — Repository Structure Audit

The `src/app/` directory has grown to roughly 100 source files spread across five flat folders. Three of those folders — `services/`, `pages/`, and `models/` — each contain 24–34 files with no sub-grouping, making it difficult to understand domain boundaries, find related files, or reason about what each service is responsible for. This document describes the current structure, catalogs every identifiable feature area, calls out the structural pain points, and proposes a reorganized layout that reflects the actual domain boundaries already present in the code.

---

## 1. Current Repository Structure

```
src/app/
  app.config.ts
  app.html
  app.routes.ts
  app.scss
  app.spec.ts
  app.ts
  components/        (12 components, mixed concerns)
  guards/            (1 file)
  models/            (24 model files, all domains flat)
  pages/             (34 page files — 3 workspaces × ~8 analysis views + home + settings, all flat)
  services/          (34 service files + 3 prompt builders in prompts/, all flat)
```

### File counts by folder

| Folder | Files | Notes |
|---|---|---|
| `components/` | 12 | Mixes shell chrome, domain widgets, and reusable display components |
| `guards/` | 1 | `workspace-init.guard.ts` only |
| `models/` | 24 | All domains flat — no grouping |
| `pages/` | 34 | Three workspace types × 8 analysis pages + home + settings, all flat |
| `services/` | 34 + 3 prompts | Six distinct concerns, zero sub-grouping |
| Root (`app.*`) | 6 | Config, routing, shell template |
| **Total** | **~89** | |

---

## 2. Feature Inventory

Fourteen distinct feature areas are identifiable from the file names and service responsibilities.

| # | Feature Area | Key Files |
|---|---|---|
| 1 | **Workspace management** | `WorkspaceManagerService`, `WorkspaceEntity`, `WorkspaceContext`, `WorkspaceClassifierService`, `CurrentWorkspaceService`, `ActiveWorkspaceService`, `WorkspaceImporterInterface`, `WorkspaceSummary`, `WorkspacePanel`, `WorkspaceSwitcherModal`, `workspace-init.guard` |
| 2 | **File analysis workspace** | `FileAnalysisPage` (upload entry), `FileArchitecturePage`, `FileDataFlowPage`, `FileCodeRecommendationsPage`, `FileSecurityPage`, `FileDocumentationPage`, `FileSystemUnderstandingPage`, `FileLearningPathPage` |
| 3 | **Folder analysis workspace** | Same 8 page shapes, prefixed `folder-` |
| 4 | **Repository analysis workspace** | Same 8 page shapes, prefixed `repository-` |
| 5 | **Knowledge pipeline** | `RepositoryKnowledgeService`, `FileContentService`, `DependencyMapperService`, `ArchitectureDetectorService`, `FileInventoryService`, `RepositoryScannerService`, `ProjectDiscoveryService`, `TechnologyDetectorService`, `WorkspaceClassifierService`; models: `knowledge.model`, `workspace.model`, `architecture-analysis.model`, `technology.model`, `repository.model` |
| 6 | **AI integration** | `AiAnalysisService`, `AiKnowledgeService`, `AnalysisService` (heuristic fallback); models: `ai-analysis-result.model`, `ai-explanation-context.model`; prompts: `repository-explanation-prompt`, `workflow-explanation-prompt`, `security-overview-prompt` |
| 7 | **Analysis features (cross-workspace)** | `SecurityAnalysisService`, `SystemUnderstandingService`, `LearningPathAnalysisService`, `RecommendationAnalysisService`, `DataFlowDiscoveryService`, `WorkflowExplorerService`, `DependencyExplorerService`, `ChangeImpactService`, `RepositoryInsightsService`, `RepositorySummaryService`, `NodeIntelligenceFacade`, `NavigationContextService` |
| 8 | **Documentation and export** | `DocumentationBuilderService`, `PdfExportService`; models: `generated-documentation.model`, `repository-summary.model` |
| 9 | **Global search** | `GlobalSearch` component, `RepositorySearchService`; model: `search-result.model` |
| 10 | **Shell / layout** | `Sidebar`, `PanelLayoutService`, `ResizeDivider`, `ThemeService`, `ActiveWorkspaceService` |
| 11 | **Shared display components** | `AnalysisPanel`, `CodeEditor`, `ExplanationCard`, `RepositoryCallout`, `RepositoryIntelligence`, `RepositoryPreview` |
| 12 | **Session / analysis state** | `CurrentAnalysisService`, `CurrentWorkspaceService`, `CurrentAnalysis`; models: `analysis-session.model`, `analysis-result.model` |
| 13 | **Settings** | `SettingsPage` |
| 14 | **Home** | `HomePage` |

---

## 3. Observations

### 3.1 Crowded folders

| Folder | Problem |
|---|---|
| `services/` | 34 service files spanning at least 6 distinct concerns (workspace lifecycle, knowledge pipeline, cross-workspace analysis, AI/HTTP, search, shell/layout) all sitting flat with no sub-grouping. There is no way to read the directory listing and understand which services belong together. |
| `pages/` | 34 page components representing 3 workspace types × up to 8 analysis sub-pages each, plus home and settings. All flat. Scrolling through the list mixes `file-`, `folder-`, and `repository-` pages with no grouping cue. |
| `models/` | 24 model files covering every domain — workspace, knowledge, AI output, security, documentation, navigation, recommendations — with no grouping. Finding the model for a given domain requires scanning the entire list. |

### 3.2 Sparse folders

| Folder | Problem |
|---|---|
| `guards/` | One file. The single guard (`workspace-init.guard.ts`) does not justify its own top-level folder. |
| `services/prompts/` | Three files. The prompt builders are already naturally grouped; they just need to move closer to the AI services that use them. |

### 3.3 Mixed-concern `components/`

The `components/` folder currently holds both shell chrome (Sidebar, ResizeDivider) and domain display widgets (AnalysisPanel, CodeEditor, ExplanationCard, repository-\* components). These have different reuse scopes and different reasons to change, but there is nothing in the directory layout to signal that distinction.

### 3.4 No domain boundaries visible from the folder tree

A developer opening `src/app/` sees only `components/`, `guards/`, `models/`, `pages/`, and `services/`. There is no way to tell from the directory structure that a knowledge pipeline, an AI integration layer, or a workspace lifecycle system exist. All of those concerns are collapsed into two flat folders.

### 3.5 Three workspace types are indistinguishable at directory level

The 24 workspace-specific pages (8 × file, 8 × folder, 8 × repository) are interleaved alphabetically in `pages/`. Navigating to "all folder analysis pages" requires filtering by prefix in a file picker rather than opening a folder.

---

## 4. Proposed Reorganized Structure

The proposal introduces eight top-level areas, each with a clear responsibility boundary. The existing files do not change — only their locations do.

```
src/app/
│
├── core/
│   │   # App-wide infrastructure: bootstrapping, routing, global config
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── app.html
│   ├── app.scss
│   ├── app.ts
│   ├── app.spec.ts
│   │
│   ├── guards/
│   │   └── workspace-init.guard.ts
│   │
│   └── services/
│       # Services with no domain affinity — used everywhere
│       ├── theme.service.ts
│       ├── panel-layout.service.ts
│       └── active-workspace.service.ts
│
├── layout/
│   │   # Shell chrome: sidebar, resize divider — rendered regardless of workspace
│   ├── sidebar/
│   │   ├── sidebar.ts
│   │   ├── sidebar.html
│   │   ├── sidebar.scss
│   │   └── sidebar.spec.ts
│   └── resize-divider/
│       ├── resize-divider.component.ts
│       └── resize-divider.component.scss
│
├── workspace/
│   │   # Workspace lifecycle: creation, switching, isolation, classification
│   ├── models/
│   │   ├── workspace-entity.model.ts
│   │   ├── workspace-context.model.ts
│   │   └── workspace.model.ts
│   ├── services/
│   │   ├── workspace-manager.service.ts
│   │   ├── workspace-classifier.service.ts
│   │   ├── workspace-importer.interface.ts
│   │   ├── current-workspace.service.ts
│   │   └── current-analysis.service.ts
│   └── components/
│       ├── workspace-panel/
│       ├── workspace-summary/
│       └── workspace-switcher-modal/
│
├── knowledge/
│   │   # File ingestion and static analysis pipeline — no AI, no HTTP
│   ├── models/
│   │   ├── knowledge.model.ts
│   │   ├── architecture-analysis.model.ts
│   │   ├── technology.model.ts
│   │   └── repository.model.ts
│   └── services/
│       ├── repository-knowledge.service.ts
│       ├── file-content.service.ts
│       ├── file-inventory.service.ts
│       ├── dependency-mapper.service.ts
│       ├── dependency-explorer.service.ts
│       ├── architecture-detector.service.ts
│       ├── repository-scanner.service.ts
│       ├── project-discovery.service.ts
│       └── technology-detector.service.ts
│
├── features/
│   │
│   ├── file-analysis/
│   │   └── pages/
│   │       ├── file-analysis-page/
│   │       ├── file-architecture-page/
│   │       ├── file-data-flow-page/
│   │       ├── file-code-recommendations-page/
│   │       ├── file-security-page/
│   │       ├── file-documentation-page/
│   │       ├── file-system-understanding-page/
│   │       └── file-learning-path-page/
│   │
│   ├── folder-analysis/
│   │   └── pages/
│   │       ├── folder-analysis-page/
│   │       ├── folder-architecture-page/
│   │       ├── folder-data-flow-page/
│   │       ├── folder-code-recommendations-page/
│   │       ├── folder-security-page/
│   │       ├── folder-documentation-page/
│   │       ├── folder-system-understanding-page/
│   │       └── folder-learning-path-page/
│   │
│   ├── repository-analysis/
│   │   └── pages/
│   │       ├── repository-analysis-page/
│   │       ├── repository-architecture-page/
│   │       ├── repository-data-flow-page/
│   │       ├── repository-code-recommendations-page/
│   │       ├── repository-security-page/
│   │       ├── repository-documentation-page/
│   │       ├── repository-system-understanding-page/
│   │       └── repository-learning-path-page/
│   │
│   ├── search/
│   │   ├── components/
│   │   │   └── global-search/
│   │   ├── models/
│   │   │   └── search-result.model.ts
│   │   └── services/
│   │       └── repository-search.service.ts
│   │
│   └── settings/
│       └── pages/
│           └── settings-page/
│
├── analysis/
│   │   # Cross-workspace domain analysis logic — used by all 3 workspace features
│   ├── models/
│   │   ├── analysis-session.model.ts
│   │   ├── analysis-result.model.ts
│   │   ├── ai-analysis-result.model.ts
│   │   ├── ai-explanation-context.model.ts
│   │   ├── data-flow.model.ts
│   │   ├── security-analysis.model.ts
│   │   ├── system-understanding.model.ts
│   │   ├── recommendation-analysis.model.ts
│   │   ├── learning-path-analysis.model.ts
│   │   ├── navigation.model.ts
│   │   ├── code-recommendation.model.ts
│   │   ├── risk-item.model.ts
│   │   ├── modernization-item.model.ts
│   │   ├── modernization-recommendation.model.ts
│   │   ├── generated-documentation.model.ts
│   │   └── repository-summary.model.ts
│   └── services/
│       ├── analysis.service.ts
│       ├── security-analysis.service.ts
│       ├── system-understanding.service.ts
│       ├── learning-path-analysis.service.ts
│       ├── recommendation-analysis.service.ts
│       ├── data-flow-discovery.service.ts
│       ├── workflow-explorer.service.ts
│       ├── change-impact.service.ts
│       ├── repository-insights.service.ts
│       ├── repository-summary.service.ts
│       ├── node-intelligence.facade.ts
│       ├── navigation-context.service.ts
│       ├── documentation-builder.service.ts
│       └── pdf-export.service.ts
│
├── ai/
│   │   # All HTTP calls to the AI backend + prompt builders
│   ├── services/
│   │   ├── ai-analysis.service.ts
│   │   └── ai-knowledge.service.ts
│   └── prompts/
│       ├── repository-explanation-prompt.ts
│       ├── security-overview-prompt.ts
│       └── workflow-explanation-prompt.ts
│
└── shared/
    │   # Reusable display components and shared UI utilities
    ├── components/
    │   ├── analysis-panel/
    │   ├── code-editor/
    │   ├── explanation-card/
    │   ├── repository-callout/
    │   ├── repository-intelligence/
    │   └── repository-preview/
    └── pages/
        └── home-page/
```

### 4.1 Rationale for key decisions

| Decision | Rationale |
|---|---|
| **Pages grouped by workspace type** | `file-analysis/`, `folder-analysis/`, `repository-analysis/` under `features/` mirrors how the router and the user think: you are in a workspace context first, then an analysis view. Grouping by analysis view type (all architecture pages together, etc.) would split what belongs together operationally. |
| **Analysis services in `analysis/`, not inside each workspace feature** | `SecurityAnalysisService`, `LearningPathAnalysisService`, etc. are called identically by all three workspace features. Co-locating them inside any one workspace folder would be misleading about their scope. |
| **`knowledge/` as its own domain** | The pipeline services (`RepositoryKnowledgeService`, `ArchitectureDetectorService`, `RepositoryScannerService`, etc.) form a pure static-analysis pipeline with no AI or HTTP involvement. Their isolation is already implicit in how `RepositoryKnowledgeService.build()` calls them sequentially; the folder makes it explicit. |
| **`ai/` isolated from everything else** | `AiAnalysisService` and `AiKnowledgeService` are the only services that make HTTP calls to the AI backend. Keeping them in their own folder makes the AI integration boundary easy to mock, swap, or audit. |
| **`workspace/` vs `core/`** | `WorkspaceManagerService` and its siblings carry domain logic (lifecycle, type routing, state scoping) and belong in `workspace/`. `ThemeService`, `PanelLayoutService`, and `ActiveWorkspaceService` have zero domain knowledge and belong in `core/services/`. |
| **`shared/components/` vs `layout/`** | `AnalysisPanel`, `CodeEditor`, `ExplanationCard`, and the `repository-*` display components are generic, reusable widgets — they go in `shared/`. `Sidebar` and `ResizeDivider` are shell chrome that renders regardless of workspace context — they go in `layout/`. |
| **Search as a feature** | `GlobalSearch` and `RepositorySearchService` are tightly coupled (the service drives the component's results). Treating search as `features/search/` keeps that coupling local and self-contained. |
| **Home page in `shared/pages/`** | `HomePage` is a routing entry point with no workspace context. It does not belong inside any workspace feature, so it lives in `shared/pages/` as a non-domain page. |
| **`guards/` collapsed into `core/`** | One guard does not need its own top-level folder. Moving it into `core/guards/` is consistent with the Angular convention of keeping routing infrastructure inside core. |
| **Prompts move to `ai/prompts/`** | The three prompt builder files already cohered in `services/prompts/`; they move intact to sit next to the AI services that consume them. |

### 4.2 Migration path

Moving files will break all relative import paths. The safest migration order is:

1. Add `tsconfig` path aliases (`@app/knowledge`, `@app/analysis`, `@app/workspace`, `@app/ai`, `@app/shared`, `@app/features`, `@app/core`, `@app/layout`) before moving any files.
2. Update all existing imports to use aliases (find-and-replace per domain, verifiable incrementally).
3. Move files one top-level folder at a time, confirming the build passes after each folder.
4. Remove the old flat folders (`services/`, `pages/`, `models/`, `components/`) once all files have migrated.

This avoids a big-bang rename that would make every file in the repository appear modified in one commit.
