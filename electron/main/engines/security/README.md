# Security Engine

Responsible for security analysis and risk identification.

Responsibilities:
- Heuristic vulnerability detection (hardcoded secrets, SQL injection, missing auth)
- Graph-based security coupling analysis (auth nodes with high inbound coupling)
- Security findings aggregation and severity ranking

Depends on: Repository Engine (DependencyGraph + SourceFile[])

Migrated from:
- src/app/analysis/services/security-analysis.service.ts
