# 04 — Model Inventory

Audit of all TypeScript model files under `src/app/models/`. Import counts reflect usages found across the full source tree at the time of this audit.

---

## 1. Full Inventory

| File | Exported Types | Import Count | Status |
|---|---|---|---|
| `ai-analysis-result.model.ts` | `AiRisk`, `AiAnalysisResult` | 4 | active |
| `ai-explanation-context.model.ts` | `RepositoryExplanationContext`, `WorkflowExplanationContext`, `ExplanationType`, `ExplanationResult` | 2 | limited |
| `analysis-result.model.ts` | `AnalysisResult` | 5 | active |
| `analysis-session.model.ts` | `AnalysisSession` | 7 | active |
| `architecture-analysis.model.ts` | `ArchitectureAnalysis` | 1 | limited |
| `code-recommendation.model.ts` | `RecommendationCategory`, `RecommendationSeverity`, `RecommendationRiskLevel`, `CodeRecommendation` | 0 | suspected-unused |
| `data-flow.model.ts` | `DataFlowNode`, `DataFlowConnection`, `DataFlow`, `WorkflowSummary`, `WorkflowCategory`, `ChangeImpactAnalysis`, `BehaviorInsights` | 3 | active |
| `generated-documentation.model.ts` | `GeneratedDocumentation` | 1 | limited |
| `knowledge.model.ts` | `SourceFile`, `DependencyNode`, `DependencyEdge`, `DependencyGraph`, `ArchitecturePattern`, `RepositoryArchitectureAnalysis`, `KnowledgeState`, `RepositoryKnowledge` | 5 | active |
| `learning-path-analysis.model.ts` | `LearningStep`, `KeyConcept`, `SystemArea`, `SuggestedReadingItem`, `IgnoreForNow`, `NextStepLink`, `LearningPathAnalysis` | 5 | active |
| `modernization-item.model.ts` | `ModernizationItem` | 4 | active |
| `modernization-recommendation.model.ts` | `ModernizationRecommendation` | 2 | limited |
| `navigation.model.ts` | `NavigationSource`, `NavigationEntry`, `Breadcrumb`, `NodeIntelligence` | 2 | limited |
| `recommendation-analysis.model.ts` | `RecommendationCategory`, `RecommendationPriority`, `CodeReference`, `Recommendation`, `RecommendationAnalysis` | 6 | active |
| `repository-summary.model.ts` | `DocumentationSectionId`, `DocumentationSection`, `KeyFile`, `KeyProject`, `RiskSummaryItem`, `ModernizationSummaryItem`, `InsightSummaryItem`, `RepositorySummary` | 6 | active |
| `repository.model.ts` | `FileNode`, `FolderNode`, `ProjectType`, `ProjectNode`, `RepositoryStructure` | 3 | active |
| `risk-item.model.ts` | `RiskItem` | 3 | active |
| `search-result.model.ts` | `SearchResultType`, `SearchNavigationTarget`, `SearchResult` | 2 | limited |
| `security-analysis.model.ts` | `SecuritySeverity`, `SecurityFindingCategory`, `SecurityFinding`, `SecurityHotspot`, `SecurityRelevantComponent`, `SecurityAnalysis` | 7 | active |
| `system-understanding.model.ts` | `HealthLevel`, `CriticalityLevel`, `SystemHealthSummary`, `ImportantItem`, `ImportantWorkflow`, `ImportantDependency`, `TechDebtHotspot`, `CoreCapability`, `SystemUnderstanding` | 7 | active |
| `technology.model.ts` | `TechnologyCategory`, `DetectionMethod`, `TechnologyDetectionResult` | 2 | limited |
| `workspace-context.model.ts` | `WorkspaceContext` | 4 | active |
| `workspace-entity.model.ts` | `WorkspaceType`, `WorkspaceStatus`, `MAX_WORKSPACES`, `Workspace` | 8 | active |
| `workspace.model.ts` | `WorkspaceType`, `FileMetadata`, `WorkspaceProfile` | 7 | duplicate |

---

## 2. Active Models

These models are imported 3 or more times and are part of the live feature surface.

| File | Import Count | Role |
|---|---|---|
| `workspace-entity.model.ts` | 8 | Top-level workspace aggregate — most-imported model in the codebase. Holds all analysis state for a workspace instance. |
| `security-analysis.model.ts` | 7 | Comprehensive security model wired to all three security pages, workspace-entity, workspace-manager, ai-knowledge.service, and security-analysis.service. |
| `system-understanding.model.ts` | 7 | Scope-aware system understanding model wired to all three system-understanding pages and the learning-path pipeline. |
| `analysis-session.model.ts` | 7 | Central session object binding a file, its source code, and both rule-based and AI analysis results. |
| `workspace.model.ts` | 7 | Classifier/upload pipeline model — `WorkspaceProfile` and `FileMetadata`. Flagged separately under duplicates due to `WorkspaceType` collision. |
| `recommendation-analysis.model.ts` | 6 | AI-generated workspace-level code recommendations with priority scores and debt analysis. |
| `repository-summary.model.ts` | 6 | Central documentation/summary aggregate for the full documentation pipeline (3 pages, builder service, PDF export). |
| `analysis-result.model.ts` | 5 | Rule-based single-file analysis result. Parallel to `AiAnalysisResult` in a different pipeline. |
| `knowledge.model.ts` | 5 | Core Stage 3 repository knowledge graph — dependency graph, architecture analysis, knowledge state. |
| `learning-path-analysis.model.ts` | 5 | Scope-aware learning path model used by all three learning-path pages and the learning-path-analysis.service. |
| `modernization-item.model.ts` | 4 | Simple modernization entry (description + priority) used in the rule-based pipeline. |
| `ai-analysis-result.model.ts` | 4 | Wraps single-file AI analysis output (architecture, modernizations, documentation). |
| `workspace-context.model.ts` | 4 | Thin wrapper pairing a `WorkspaceProfile` with an upload timestamp and display name. |
| `data-flow.model.ts` | 3 | Stage 7 behavior/data flow models. `WorkflowSummary` and `BehaviorInsights` feed into repository-summary and ai-explanation-context. |
| `repository.model.ts` | 3 | Stage 2 structural metadata — folder tree and project nodes. |
| `risk-item.model.ts` | 3 | Simple risk entry (description + severity) for the rule-based single-file pipeline. |

---

## 3. Duplicate and Overlapping Models

These are review candidates. Each group describes types that serve near-identical purposes across different pipelines or scopes, or that share an exported name with conflicting definitions.

### 3.1 Modernization — three parallel types

| Type | Source File | Shape | Pipeline |
|---|---|---|---|
| `ModernizationItem` | `modernization-item.model.ts` | `description` + `priority` ('low'\|'medium'\|'high') | Rule-based single-file |
| `ModernizationRecommendation` | `modernization-recommendation.model.ts` | `title` + `description` | AI single-file |
| `ModernizationSummaryItem` | `repository-summary.model.ts` | `title` + `description` | Repository-level summary |

`ModernizationRecommendation` and `ModernizationSummaryItem` are structurally identical. All three represent the same concept at different fidelity levels. `modernization-recommendation.model.ts` is a candidate for consolidation into `repository-summary.model.ts` or a shared base type.

### 3.2 Risk — three parallel types

| Type | Source File | Shape | Pipeline |
|---|---|---|---|
| `RiskItem` | `risk-item.model.ts` | `description` + `severity` | Rule-based single-file |
| `AiRisk` | `ai-analysis-result.model.ts` | `title` + `severity` + `description` | AI single-file |
| `RiskSummaryItem` | `repository-summary.model.ts` | `title` + `description` + `severity` | Repository-level summary |

`AiRisk` and `RiskSummaryItem` are structurally near-identical. All three describe the same concept. A shared `RiskEntry` base interface would eliminate the spread.

### 3.3 RecommendationCategory — name collision across two files

| Type | Source File | Values | Status |
|---|---|---|---|
| `RecommendationCategory` | `recommendation-analysis.model.ts` | `'architecture'` \| `'maintainability'` \| etc. | active (6 imports) |
| `RecommendationCategory` | `code-recommendation.model.ts` | `'issues'` \| `'modernization'` \| `'security'` | suspected-unused (0 imports) |

Same exported name, different value sets. Any future import of `code-recommendation.model.ts` into a file that also imports `recommendation-analysis.model.ts` will cause a silent name collision. The unused file should be deleted or, if it is to be kept, its `RecommendationCategory` must be renamed.

### 3.4 ArchitectureAnalysis — same concept at different fidelity

| Type | Source File | Shape |
|---|---|---|
| `ArchitectureAnalysis` | `architecture-analysis.model.ts` | Flat string arrays (patterns, responsibilities, dependencies) |
| `RepositoryArchitectureAnalysis` | `knowledge.model.ts` | Structured `ArchitecturePattern` objects with confidence scores |

The file-level comment in `architecture-analysis.model.ts` explicitly acknowledges this overlap. `ArchitectureAnalysis` (flat strings) is only consumed by `ai-analysis-result.model` — it is a candidate for replacement by a scoped subset of the richer `RepositoryArchitectureAnalysis`.

### 3.5 WorkspaceType — identical name, different values, same import chain

| Type | Source File | Values |
|---|---|---|
| `WorkspaceType` | `workspace.model.ts` | `'SingleFile'` \| `'MultiFile'` \| `'Project'` \| `'Repository'` |
| `WorkspaceType` | `workspace-entity.model.ts` | `'file'` \| `'folder'` \| `'repository'` |

`analysis-session.model.ts` imports both files, bringing both enums into the same dependency chain under the same name. This is a live naming collision risk. One of these must be renamed. The `workspace.model.ts` variant is the classifier/upload-time classification; the `workspace-entity.model.ts` variant is the runtime workspace scope — they are distinct concepts that happen to share a name.

---

## 4. Suspected Unused Models

| File | Exports | Import Count | Notes |
|---|---|---|---|
| `code-recommendation.model.ts` | `RecommendationCategory`, `RecommendationSeverity`, `RecommendationRiskLevel`, `CodeRecommendation` | 0 | No imports found anywhere in the codebase. `CodeRecommendation` overlaps heavily with `Recommendation` in `recommendation-analysis.model.ts`. The exported `RecommendationCategory` name conflicts with the active enum of the same name in `recommendation-analysis.model.ts`. Safe to delete unless a feature branch depends on it. |

---

## 5. Limited-Reach Models

These models have 2 or fewer import sites but are not flagged as unused. Their limited reach is either by design (narrow concern) or may indicate incomplete integration.

| File | Import Count | Assessment |
|---|---|---|
| `ai-explanation-context.model.ts` | 2 | Narrow by design — context object for AI calls and workspace entity storage. Appropriate reach. |
| `architecture-analysis.model.ts` | 1 | Only consumed by `ai-analysis-result.model`. Consolidation candidate (see §3.4). |
| `generated-documentation.model.ts` | 1 | Only consumed by `ai-analysis-result.model`. Similar overlap concern with `repository-summary.model.ts`. |
| `modernization-recommendation.model.ts` | 2 | Only consumed within the AI single-file pipeline. Consolidation candidate (see §3.1). |
| `navigation.model.ts` | 2 | Only consumed by `navigation-context.service` and `node-intelligence.facade`. May reflect an in-progress nav redesign where pages have not yet adopted it. |
| `search-result.model.ts` | 2 | Global search concern. Two consumers (component + service) is the correct and complete reach for this model. |
| `technology.model.ts` | 2 | Used by `workspace.model` and `technology-detector.service` — appropriate for a detection-pipeline-scoped type. |
