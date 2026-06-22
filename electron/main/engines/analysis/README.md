# Analysis Engine

Responsible for deriving intelligence from a built DependencyGraph.

Responsibilities:
- Repository summaries and metrics (RepositorySummaryEngine)
- Graph insights: hubs, orphans, broad-scope nodes (RepositoryInsightsEngine)
- Graph query utilities (DependencyExplorerEngine)
- Single-file pattern classification (AnalysisEngine)
- Recommendations: coupling, circular deps, isolation (RecommendationAnalysisEngine)
- System understanding synthesis (SystemUnderstandingEngine)

Depends on: Repository Engine (DependencyGraph must be built first)

Migrated from:
- src/app/analysis/services/analysis.service.ts
- src/app/analysis/services/repository-insights.service.ts
- src/app/analysis/services/repository-summary.service.ts
- src/app/analysis/services/recommendation-analysis.service.ts
- src/app/analysis/services/system-understanding.service.ts
- src/app/knowledge/services/dependency-explorer.service.ts
