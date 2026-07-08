import { Injectable } from '@angular/core';
import { RepositoryStructure } from '../models/repository.model';
import { DependencyGraph, RepositoryArchitectureAnalysis } from '../models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class ArchitectureDetectorService {
  constructor(private readonly electron: ElectronService) {}

  async detect(structure: RepositoryStructure, graph: DependencyGraph): Promise<RepositoryArchitectureAnalysis> {
    return this.electron.intelligenceDetectArchitecture(structure, graph) as Promise<RepositoryArchitectureAnalysis>;
  }
}
