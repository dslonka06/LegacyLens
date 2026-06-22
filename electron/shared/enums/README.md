# Shared Enums

TypeScript enums shared across the Angular/Electron boundary.

Phase 1 enums to migrate here:
- KnowledgeState (from src/app/knowledge/models/knowledge.model.ts)
- WorkspaceType (reconciled from workspace.model.ts and workspace-entity.model.ts)
- WorkspaceStatus (from workspace-entity.model.ts)

Note: WorkspaceType currently has a naming inconsistency —
  workspace.model.ts:     'SingleFile' | 'MultiFile' | 'Project' | 'Repository'
  workspace-entity.model.ts: 'file' | 'folder' | 'repository'
These serve different purposes. Reconcile when migrating to shared contracts.
