import { WorkspaceProfile } from '../models/workspace.model';

export interface IWorkspaceImporter {
  import(files: File[]): Promise<WorkspaceProfile>;
}
