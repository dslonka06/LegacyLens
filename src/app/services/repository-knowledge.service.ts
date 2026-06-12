import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { KnowledgeState, RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { WorkspaceManagerService } from './workspace-manager.service';
import { FileContentService } from './file-content.service';
import { DependencyMapperService } from './dependency-mapper.service';
import { ArchitectureDetectorService } from './architecture-detector.service';

@Injectable({ providedIn: 'root' })
export class RepositoryKnowledgeService {

  readonly state$: Observable<KnowledgeState> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.knowledgeState ?? KnowledgeState.NotStarted),
  );

  readonly knowledge$: Observable<RepositoryKnowledge | null> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.knowledge ?? null),
  );

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly fileContent: FileContentService,
    private readonly dependencyMapper: DependencyMapperService,
    private readonly architectureDetector: ArchitectureDetectorService,
  ) {}

  get state(): KnowledgeState {
    return this.manager.getActive()?.knowledgeState ?? KnowledgeState.NotStarted;
  }

  get knowledge(): RepositoryKnowledge | null {
    return this.manager.getActive()?.knowledge ?? null;
  }

  clear(): void {
    const id = this.manager.activeId;
    if (id) this.manager.clearKnowledge(id);
  }

  async build(rawFiles: File[], profile: WorkspaceProfile): Promise<RepositoryKnowledge> {
    const id = this.manager.activeId;
    if (!id) throw new Error('No active workspace');

    this.manager.setKnowledgeState(id, KnowledgeState.ReadingFiles);
    const sourceFiles = await this.fileContent.readFiles(rawFiles);

    this.manager.setKnowledgeState(id, KnowledgeState.BuildingDependencies);
    let dependencyGraph = undefined;
    try {
      dependencyGraph = this.dependencyMapper.buildGraph(sourceFiles);
    } catch { /* non-fatal */ }

    this.manager.setKnowledgeState(id, KnowledgeState.DetectingArchitecture);
    let architecture = undefined;
    try {
      if (profile.repositoryStructure && dependencyGraph) {
        architecture = this.architectureDetector.detect(profile.repositoryStructure, dependencyGraph);
      }
    } catch { /* non-fatal */ }

    const knowledge: RepositoryKnowledge = {
      sourceFiles,
      dependencyGraph,
      architecture,
      builtAt: new Date().toISOString(),
    };

    this.manager.setKnowledgeState(id, KnowledgeState.Complete);
    this.manager.setKnowledge(id, knowledge);

    return knowledge;
  }
}
