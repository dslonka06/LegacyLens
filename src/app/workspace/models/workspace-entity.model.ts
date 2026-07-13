import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

export type WorkspaceType = 'file' | 'folder' | 'repository';

export type WorkspaceStatus =
  | 'empty' // created, nothing uploaded yet
  | 'processing' // structural knowledge pipeline running
  | 'ready' // structural knowledge complete; AI may still be running
  | 'failed' // app closed or crashed mid-analysis; previous run did not complete
  | 'error'; // pipeline failed during the current session

export const MAX_WORKSPACES = 3;

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  createdAt: string;
  lastModifiedAt: string;

  /** Links to the SQLite repository record. null for file workspaces (not persisted). */
  repositoryId: string | null;

  /**
   * The single source of truth for all analyzed content.
   * null until WorkspaceKnowledgeService.process() completes its structural phase.
   * ai.* fields are populated asynchronously after the structural build.
   *
   * READ ONLY everywhere except WorkspaceKnowledgeService.
   */
  knowledgeModel: KnowledgeModel | null;
}
