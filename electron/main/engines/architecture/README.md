# Architecture Engine

Responsible for understanding structural design and data movement.

Responsibilities:
- Architecture pattern detection (ArchitectureDetectorEngine)
- Data flow tracing through dependency graph (DataFlowDiscoveryEngine)
- Workflow narration and humanization (WorkflowExplorerEngine)

Depends on: Repository Engine (DependencyGraph), Analysis Engine (insights)

Migrated from:
- src/app/knowledge/services/architecture-detector.service.ts
- src/app/analysis/services/data-flow-discovery.service.ts
- src/app/analysis/services/workflow-explorer.service.ts
