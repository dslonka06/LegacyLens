import { WorkspaceProfile } from './workspace.model';

export interface WorkspaceContext {
  profile: WorkspaceProfile;
  uploadedAt: Date;
  // Human-readable name for display — derived from folder name, project file, or 'Untitled'
  workspaceName: string;
}
