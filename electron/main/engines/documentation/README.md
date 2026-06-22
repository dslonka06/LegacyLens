# Documentation Engine

Responsible for documentation generation and export preparation.

Responsibilities:
- Section catalogue management (7/9/11 sections by scope)
- Documentation text assembly from RepositorySummary
- PDF report generation (Phase 2: native fs write instead of browser download)
- Export format preparation

Depends on: Analysis Engine (RepositorySummary)

Migrated from:
- src/app/analysis/services/documentation-builder.service.ts
- src/app/analysis/services/pdf-export.service.ts (export path changes in Phase 2)
