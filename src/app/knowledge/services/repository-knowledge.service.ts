import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { KnowledgeState, RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '@app/workspace/models/workspace.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { FileContentService } from './file-content.service';
import { DependencyMapperService } from './dependency-mapper.service';
import { ArchitectureDetectorService } from './architecture-detector.service';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class RepositoryKnowledgeService {

  private readonly manager = inject(WorkspaceManagerService);
  private readonly fileContent = inject(FileContentService);
  private readonly dependencyMapper = inject(DependencyMapperService);
  private readonly architectureDetector = inject(ArchitectureDetectorService);
  private readonly electron = inject(ElectronService);

  readonly state$: Observable<KnowledgeState> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.knowledgeState ?? KnowledgeState.NotStarted),
  );

  readonly knowledge$: Observable<RepositoryKnowledge | null> = this.manager.activeWorkspace$.pipe(
    map(ws => ws?.knowledge ?? null),
  );

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

    this.persistAnalysis(id, knowledge, profile);

    return knowledge;
  }

  private persistAnalysis(workspaceId: string, knowledge: RepositoryKnowledge, profile: WorkspaceProfile): void {
    if (!this.electron.isElectron) return;

    const ws = this.manager.getById(workspaceId);
    const repositoryId = ws?.repositoryId;
    if (!repositoryId) return;

    const patternResult = {
      totalFiles: profile.totalFiles,
      languages: profile.languages,
      technologies: profile.technologies,
      architecture: knowledge.architecture ?? null,
      dependencyEdges: knowledge.dependencyGraph?.edges.length ?? 0,
    };

    this.electron.saveAnalysis({
      repositoryId,
      scope: ws!.type,
      patternResult,
    }).catch(() => { /* non-fatal — analysis still available in-memory */ });
  }
}
