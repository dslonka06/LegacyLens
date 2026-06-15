# Service Inventory

## Overview

This document catalogues all Angular services in `src/app/services/`, grouped by category. Import counts were derived from a static grep scan of the codebase and reflect direct consumer count only (not transitive).

**Status legend:**

| Status | Meaning |
|---|---|
| `active` | 3+ direct importers; broadly consumed |
| `limited` | 1–2 direct importers; narrow usage |
| `suspected-unused` | 0 direct importers found in scan |
| `deprecated` | Explicitly superseded; safe to remove |

---

## 1. Service Inventory by Category

### AI

| Service | Purpose | Importers | Status |
|---|---|---|---|
| AiAnalysisService | Sends a single source file to `/api/ai/analyze` and returns a structured `AiAnalysisResult` | 1 | limited |
| AiKnowledgeService | Generates AI narrative explanations for repositories, workflows, and security posture via `/api/ai/explain` | 3 | active |
| RepositoryExplanationPromptBuilder | Builds the AI prompt string for repository-level explanation requests | 1 | limited |
| SecurityOverviewPromptBuilder | Builds the AI prompt string for security overview narratives | 1 | limited |
| WorkflowExplanationPromptBuilder | Builds the AI prompt string for workflow-level explanation requests | 1 | limited |

### Analysis

| Service | Purpose | Importers | Status |
|---|---|---|---|
| AnalysisService | Pattern-based static code classification returning a populated `AnalysisResult` | 1 | limited |
| ArchitectureDetectorService | Detects architectural patterns (Clean Architecture, MVC, CQRS, etc.) via folder-name confidence scoring | 1 | limited |
| ChangeImpactService | Computes direct/indirect affected files and touched workflows for a dependency-graph node | 1 | limited |
| DataFlowDiscoveryService | Discovers data-flow workflows from the dependency graph by inferring node roles and tracing chains | 4 | active |
| DependencyExplorerService | Graph-query utilities — inbound/outbound lookups, connectivity rankings, orphan/hub detection | 7 | active |
| DependencyMapperService | Parses source files to extract import/using/SQL dependencies and builds a `DependencyGraph` | 1 | limited |
| LearningPathAnalysisService | Generates structured onboarding learning paths for file, folder, and repository scopes | 3 | active |
| NodeIntelligenceFacade | Aggregates per-node intelligence into a single `NodeIntelligence` object from underlying services | 0 | suspected-unused |
| ProjectDiscoveryService | Identifies project roots by matching anchor files and labelling type, framework, and language | 1 | limited |
| RecommendationAnalysisService | Produces prioritised code recommendations from AI risks, coupling findings, and modernisation items | 3 | active |
| RepositoryInsightsService | Derives structured `RepositoryInsight` items (high coupling, broad scope, hubs, orphans) from a dependency graph | 6 | active |
| RepositoryScannerService | Builds a hierarchical `FolderNode`/`FileNode` tree from flat `FileMetadata` | 1 | limited |
| RepositorySummaryService | Builds a comprehensive `RepositorySummary` aggregating architecture, data flow, dependencies, risks, and onboarding content | 5 | active |
| SecurityAnalysisService | Heuristic security analysis — hardcoded secrets, SQL injection, missing authorisation, sensitive component exposure | 3 | active |
| SystemUnderstandingService | Derives a `SystemUnderstanding` model (executive summary, business purpose, health metrics) for file/folder/repo scopes | 3 | active |
| TechnologyDetectorService | Detects frameworks, runtimes, build tools, CI/CD, databases, and test frameworks from file names/extensions | 1 | limited |
| WorkflowExplorerService | Converts raw `DataFlow` objects into human-readable `WorkflowSummary` records | 5 | active |

### Workspace

| Service | Purpose | Importers | Status |
|---|---|---|---|
| CurrentAnalysisService | Thin facade exposing the active workspace's `AnalysisSession` as a stream | 8 | active |
| CurrentWorkspaceService | Thin facade exposing the active workspace's context and profile; handles workspace naming | 15 | active |
| IWorkspaceImporter | Interface contract for any class converting a `File` array into a `WorkspaceProfile` | 0 | suspected-unused |
| RepositoryKnowledgeService | Orchestrates the full knowledge-build pipeline and stores results on the active workspace | 12 | active |
| WorkspaceClassifierService | Classifies an uploaded file set into a `WorkspaceProfile` via tech/scanner/project discovery | 1 | limited |
| WorkspaceManagerService | Central workspace state store managing up to three concurrent workspaces and all scoped data mutations | 19 | active |

### Navigation

| Service | Purpose | Importers | Status |
|---|---|---|---|
| ActiveWorkspaceService | Detects and exposes which workspace type is active by listening to Angular router events | 2 | limited |
| NavigationContextService | Manages node-navigation state for the repository file tree (selected node, history, breadcrumbs) | 1 | limited |
| RepositorySearchService | Builds and queries an in-memory text index of workspace entities for the global search feature | 1 | limited |

### Export

| Service | Purpose | Importers | Status |
|---|---|---|---|
| DocumentationBuilderService | Defines scoped documentation section catalogues and renders sections as plain text for preview | 5 | active |
| PdfExportService | Generates styled PDF reports from `AnalysisSession` or `RepositorySummary` sections using jsPDF | 3 | active |

### Utility

| Service | Purpose | Importers | Status |
|---|---|---|---|
| FileContentService | Reads uploaded `File` objects into `SourceFile` records using the `FileReader` API | 1 | limited |
| FileInventoryService | Converts raw browser `File` objects into `FileMetadata` records | 1 | limited |
| PanelLayoutService | Persists and restores resizable panel widths to `localStorage` | 6 | active |
| ThemeService | Manages light/dark theme state, persisting preference and applying `data-theme` to the document root | 3 | active |

---

## 2. Active Services

These services have 3 or more direct importers and are load-bearing across the application.

| Service | Category | Importers |
|---|---|---|
| WorkspaceManagerService | Workspace | 19 |
| CurrentWorkspaceService | Workspace | 15 |
| RepositoryKnowledgeService | Workspace | 12 |
| CurrentAnalysisService | Workspace | 8 |
| DependencyExplorerService | Analysis | 7 |
| PanelLayoutService | Utility | 6 |
| RepositoryInsightsService | Analysis | 6 |
| DocumentationBuilderService | Export | 5 |
| RepositorySummaryService | Analysis | 5 |
| WorkflowExplorerService | Analysis | 5 |
| DataFlowDiscoveryService | Analysis | 4 |
| AiKnowledgeService | AI | 3 |
| LearningPathAnalysisService | Analysis | 3 |
| PdfExportService | Export | 3 |
| RecommendationAnalysisService | Analysis | 3 |
| SecurityAnalysisService | Analysis | 3 |
| SystemUnderstandingService | Analysis | 3 |
| ThemeService | Utility | 3 |

---

## 3. Limited-Use Services (1–2 Importers)

These services have only one or two direct consumers. They are candidates for consolidation or inlining, but are not necessarily dead — many sit deep in the pipeline and are only reached indirectly.

| Service | Category | Importers | Notes |
|---|---|---|---|
| ActiveWorkspaceService | Navigation | 2 | Thin route-detection wrapper around `WorkspaceManagerService`; consolidation candidate |
| AiAnalysisService | AI | 1 | File-by-file AI flow; distinct from `AiKnowledgeService` but narrow reach |
| AnalysisService | Analysis | 1 | Predates AI analysis; large hardcoded switch — may become redundant as AI coverage expands |
| ArchitectureDetectorService | Analysis | 1 | Reached only via `RepositoryKnowledgeService`; no direct page consumers |
| ChangeImpactService | Analysis | 1 | Reached only via `NodeIntelligenceFacade`, which itself has 0 direct page imports |
| DependencyMapperService | Analysis | 1 | Foundational to knowledge build; narrow by design |
| FileContentService | Utility | 1 | Entry point for all file content into the knowledge pipeline; narrow by design |
| FileInventoryService | Utility | 1 | Overlap risk with `WorkspaceClassifierService` which does similar metadata extraction inline |
| NavigationContextService | Navigation | 1 | Only `global-search` imports it; the `repository-navigation` page likely uses it but was not captured in the scan — warrants verification |
| ProjectDiscoveryService | Analysis | 1 | Reached only via `WorkspaceClassifierService`; narrow by design |
| RepositoryExplanationPromptBuilder | AI | 1 | Prompt-builder pattern is intentionally narrow |
| RepositoryScannerService | Analysis | 1 | Reached only via `WorkspaceClassifierService` |
| RepositorySearchService | Navigation | 1 | Only `global-search` imports it; appropriate given its purpose |
| SecurityOverviewPromptBuilder | AI | 1 | Prompt-builder pattern is intentionally narrow |
| TechnologyDetectorService | Analysis | 1 | Reached only via `WorkspaceClassifierService`; output surfaces throughout the UI |
| WorkflowExplanationPromptBuilder | AI | 1 | Prompt-builder pattern is intentionally narrow |
| WorkspaceClassifierService | Workspace | 1 | Foundational to every workspace yet only `code-editor` imports it directly — upload entry point is narrow |

---

## 4. Suspected-Unused Services — HIGH CONFIDENCE REMOVAL CANDIDATES

These services had zero direct imports detected in the grep scan. They should be investigated before any removal.

| Service | Category | Notes |
|---|---|---|
| NodeIntelligenceFacade | Analysis | No direct imports found. May be consumed by `repository-navigation` page which was not fully represented in the scan. Verify before removing. |
| IWorkspaceImporter | Workspace | Interface with no known implementors or consumers. Appears to be an abandoned abstraction planned for multiple importer implementations. Low risk to remove once confirmed unused. |

**Recommended action:** Run a full project-wide import search for both identifiers before deleting. If `NodeIntelligenceFacade` is genuinely unreachable, `ChangeImpactService` (its only downstream consumer) is also a removal candidate.

---

## 5. Deprecated Services

No services have been explicitly marked deprecated in the codebase at the time of this audit. However, the following are functionally at risk of obsolescence and should be reviewed during the next cleanup cycle:

| Service | Reason |
|---|---|
| AnalysisService | Large hardcoded pattern-match service that predates AI analysis. As `AiAnalysisService` and `AiKnowledgeService` expand coverage, `AnalysisService` may serve no unique purpose. |
| IWorkspaceImporter | Abandoned interface abstraction with no implementors. Candidate for deletion rather than deprecation. |
