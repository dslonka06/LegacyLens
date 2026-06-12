export type ModifiedFileStatus = 'pending' | 'approved' | 'rejected';

// Legacy scope type — kept for AnalysisSession.scope backward compat.
// New code should use workspaceId instead.
export type WorkspaceScope = 'file' | 'folder' | 'repository';

export interface ModifiedFile {
  id: string;
  filePath: string;
  fileName: string;
  originalContent: string;
  modifiedContent: string;
  modifiedAt: string;
  status: ModifiedFileStatus;
  // Workspace that owns this change — replaces the old WorkspaceScope field
  workspaceId: string;
  // Recommendation metadata preserved at save time
  recommendationId?: string;
  recommendationTitle?: string;
  category?: string;
  severity?: string;
}
