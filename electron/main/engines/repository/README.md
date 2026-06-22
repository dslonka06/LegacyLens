# Repository Engine

Foundation of all analysis. Responsible for understanding repository structure.

Responsibilities:
- Repository discovery and scanning (RepositoryScannerEngine)
- File classification and inventory (FileInventoryEngine)
- Technology detection (TechnologyDetectorEngine)
- Dependency graph construction (DependencyMapperEngine)
- Project detection (ProjectDiscoveryEngine)
- Workspace classification (WorkspaceClassifierEngine)
- Full knowledge build pipeline (RepositoryKnowledgeEngine)

Phase 2+: will use native fs instead of browser FileReader.
Phase 3+: results indexed to SQLite for instant re-open.

Migrated from:
- src/app/knowledge/services/
- src/app/workspace/services/workspace-classifier.service.ts
