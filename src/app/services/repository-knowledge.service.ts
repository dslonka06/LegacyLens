import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { KnowledgeState, RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { WorkspaceScope } from '../models/modified-file.model';
import { WorkspaceManagerService } from './workspace-manager.service';
import { ActiveWorkspaceService } from './active-workspace.service';
import { FileContentService } from './file-content.service';
import { DependencyMapperService } from './dependency-mapper.service';
import { ArchitectureDetectorService } from './architecture-detector.service';

@Injectable({ providedIn: 'root' })
export class RepositoryKnowledgeService {

  // Emits the active scope's knowledge, switching automatically on workspace change.
  readonly state$:     Observable<KnowledgeState>;
  readonly knowledge$: Observable<RepositoryKnowledge | null>;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly activeWorkspace: ActiveWorkspaceService,
    private readonly fileContent: FileContentService,
    private readonly dependencyMapper: DependencyMapperService,
    private readonly architectureDetector: ArchitectureDetectorService,
  ) {
    this.state$ = this.activeWorkspace.workspace$.pipe(
      switchMap(ws => this.manager.knowledgeState$(this.toScope(ws))),
    );
    this.knowledge$ = this.activeWorkspace.workspace$.pipe(
      switchMap(ws => this.manager.knowledge$(this.toScope(ws))),
    );
  }

  get state(): KnowledgeState {
    return this.manager.getKnowledgeState(this.activeScope);
  }

  get knowledge(): RepositoryKnowledge | null {
    return this.manager.getKnowledge(this.activeScope);
  }

  clear(): void {
    this.manager.clearKnowledge(this.activeScope);
  }

  async build(
    rawFiles: File[],
    profile: WorkspaceProfile
  ): Promise<RepositoryKnowledge> {
    const scope = this.activeScope;

    this.manager.setKnowledgeState(scope, KnowledgeState.ReadingFiles);
    const sourceFiles = await this.fileContent.readFiles(rawFiles);

    this.manager.setKnowledgeState(scope, KnowledgeState.BuildingDependencies);
    let dependencyGraph = undefined;
    try {
      dependencyGraph = this.dependencyMapper.buildGraph(sourceFiles);
    } catch {
      // Non-fatal: proceed without graph
    }

    this.manager.setKnowledgeState(scope, KnowledgeState.DetectingArchitecture);
    let architecture = undefined;
    try {
      if (profile.repositoryStructure && dependencyGraph) {
        architecture = this.architectureDetector.detect(
          profile.repositoryStructure,
          dependencyGraph
        );
      }
    } catch {
      // Non-fatal: proceed without architecture analysis
    }

    const knowledge: RepositoryKnowledge = {
      sourceFiles,
      dependencyGraph,
      architecture,
      builtAt: new Date().toISOString(),
    };

    this.manager.setKnowledgeState(scope, KnowledgeState.Complete);
    this.manager.setKnowledge(scope, knowledge);

    return knowledge;
  }

  private get activeScope(): WorkspaceScope {
    return this.toScope(this.activeWorkspace.workspace);
  }

  private toScope(ws: string | null): WorkspaceScope {
    if (ws === 'folder')     return 'folder';
    if (ws === 'repository') return 'repository';
    return 'file';
  }
}
