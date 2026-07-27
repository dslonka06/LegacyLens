# Analysis Engine

Derives intelligence from a built `DependencyGraph`.

## Responsibilities

- Repository summaries and metrics (`RepositorySummaryEngine`)
- Graph insights: hubs, orphans, broad-scope nodes (`RepositoryInsightsEngine`)
- Graph query utilities (`DependencyExplorerEngine`)
- Single-file pattern classification (`AnalysisEngine`)
- Recommendations: coupling, circular deps, isolation (`RecommendationAnalysisEngine`)
- System understanding synthesis (`SystemUnderstandingEngine`)

Depends on: Repository Engine (DependencyGraph must be built first)
