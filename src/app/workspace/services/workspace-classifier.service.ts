import { Injectable } from '@angular/core';
import { FileMetadata, WorkspaceProfile } from '../models/workspace.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceClassifierService {
  constructor(private readonly electron: ElectronService) {}

  async classify(files: FileMetadata[]): Promise<WorkspaceProfile> {
    return this.electron.intelligenceClassifyWorkspace(files) as Promise<WorkspaceProfile>;
  }
}
