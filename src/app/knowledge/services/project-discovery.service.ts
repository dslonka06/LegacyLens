import { Injectable } from '@angular/core';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { ElectronService } from '@app/core/services/electron.service';

export interface ProjectNode {
  name: string;
  path: string;
  type: string;
  configFile: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectDiscoveryService {
  constructor(private readonly electron: ElectronService) {}

  async discoverProjects(files: FileMetadata[]): Promise<ProjectNode[]> {
    return this.electron.intelligenceDiscoverProjects(files) as Promise<ProjectNode[]>;
  }
}
