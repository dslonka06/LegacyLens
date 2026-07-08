import { Injectable } from '@angular/core';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { RepositoryStructure } from '../models/repository.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class RepositoryScannerService {
  constructor(private readonly electron: ElectronService) {}

  async scan(files: FileMetadata[]): Promise<RepositoryStructure> {
    return this.electron.intelligenceScanRepository(files) as Promise<RepositoryStructure>;
  }
}
