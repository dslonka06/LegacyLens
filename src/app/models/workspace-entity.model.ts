import { AnalysisSession } from './analysis-session.model';
import { WorkspaceContext } from './workspace-context.model';
import { RepositoryKnowledge, KnowledgeState } from './knowledge.model';
import { ModifiedFile } from './modified-file.model';

export type WorkspaceType = 'file' | 'folder' | 'repository';

export type WorkspaceStatus =
  | 'empty'            // created, nothing uploaded yet
  | 'loaded'           // content uploaded, analysis complete
  | 'analyzing'        // knowledge pipeline running
  | 'modified'         // has pending changes
  | 'changes-pending'; // changes approved but not exported

export const MAX_WORKSPACES = 3;

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  createdAt: string;
  lastModifiedAt: string;
  // Analysis state — all owned by this workspace
  session:        AnalysisSession | null;
  context:        WorkspaceContext | null;
  knowledge:      RepositoryKnowledge | null;
  knowledgeState: KnowledgeState;
  changes:        ModifiedFile[];
}
