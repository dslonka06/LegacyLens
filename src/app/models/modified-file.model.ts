export type ModifiedFileStatus = 'pending' | 'approved' | 'rejected' | 'exported';

// Legacy scope type — kept for AnalysisSession.scope backward compat.
// New code should use workspaceId instead.
export type WorkspaceScope = 'file' | 'folder' | 'repository';

export interface RecommendationSource {
  id: string;
  title: string;
  category: string;
  severity: string;
}

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
  // All recommendations that contributed to this file's changes
  recommendations: RecommendationSource[];
}
