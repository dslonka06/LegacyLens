export type ModifiedFileStatus = 'pending' | 'approved' | 'rejected';
export type WorkspaceScope = 'file' | 'folder' | 'repository';

export interface ModifiedFile {
  id: string;
  filePath: string;
  fileName: string;
  originalContent: string;
  modifiedContent: string;
  modifiedAt: string;
  status: ModifiedFileStatus;
  scope: WorkspaceScope;
  // Recommendation metadata preserved at save time
  recommendationId?: string;
  recommendationTitle?: string;
  category?: string;
  severity?: string;
}
