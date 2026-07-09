import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { KnowledgeState, RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '@app/workspace/models/workspace.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { FileContentService } from './file-content.service';
import { DependencyMapperService } from './dependency-mapper.service';
import { ArchitectureDetectorService } from './architecture-detector.service';
import { ElectronService } from '@app/core/services/electron.service';
import type { ElectronDirectoryEntry } from '../../../electron';
import { hashContent } from '@app/core/utils/hash';

@Injectable({ providedIn: 'root' })
export class RepositoryKnowledgeService {

  private readonly manager = inject(WorkspaceManagerService);
  private readonly fileContent = inject(FileContentService);
  private readonly dependencyMapper = inject(DependencyMapperService);
  private readonly architectureDetector = inject(ArchitectureDetectorService);
  private readonly electron = inject(ElectronService);

  // Derive KnowledgeState from workspace status for backward compatibility with pages
  // that still observe this observable.
  readonly state$: Observable<KnowledgeState> = this.manager.activeWorkspace$.pipe(
    map(ws => {
      switch (ws?.status) {
        case 'processing': return KnowledgeState.BuildingDependencies;
        case 'ready':      return KnowledgeState.Complete;
        case 'error':      return KnowledgeState.Failed;
        default:           return KnowledgeState.NotStarted;
      }
    }),
  );

  // Expose the legacy RepositoryKnowledge shape derived from the KnowledgeModel.
  // Architecture pages still consume this until they are migrated to read knowledgeModel directly.
  readonly knowledge$: Observable<RepositoryKnowledge | null> = this.manager.activeWorkspace$.pipe(
    map(ws => {
      const model = ws?.knowledgeModel;
      if (!model) return null;
      return {
        sourceFiles:     [],
        dependencyGraph: model.relationships.dependencies?.graph,
        architecture:    model.relationships.architecture
          ? { patterns: model.relationships.architecture.patterns }
          : undefined,
        builtAt: model.metadata.builtAt,
      };
    }),
  );

  get state(): KnowledgeState {
    const ws = this.manager.getActive();
    switch (ws?.status) {
      case 'processing': return KnowledgeState.BuildingDependencies;
      case 'ready':      return KnowledgeState.Complete;
      case 'error':      return KnowledgeState.Failed;
      default:           return KnowledgeState.NotStarted;
    }
  }

  get knowledge(): RepositoryKnowledge | null {
    const model = this.manager.getActive()?.knowledgeModel;
    if (!model) return null;
    return {
      sourceFiles:     [],
      dependencyGraph: model.relationships.dependencies?.graph,
      architecture:    model.relationships.architecture
        ? { patterns: model.relationships.architecture.patterns }
        : undefined,
      builtAt: model.metadata.builtAt,
    };
  }

  clear(): void {
    const id = this.manager.activeId;
    if (id) this.manager.clearKnowledgeModel(id);
  }

  async build(rawFiles: File[], profile: WorkspaceProfile, entries?: ElectronDirectoryEntry[]): Promise<RepositoryKnowledge> {
    const id = this.manager.activeId;
    if (!id) throw new Error('No active workspace');

    this.manager.setProcessing(id);
    const sourceFiles = await this.fileContent.readFiles(rawFiles);

    let dependencyGraph = undefined;
    try {
      dependencyGraph = await this.dependencyMapper.buildGraph(sourceFiles);
    } catch { /* non-fatal */ }

    let architecture = undefined;
    try {
      if (profile.repositoryStructure && dependencyGraph) {
        architecture = await this.architectureDetector.detect(profile.repositoryStructure, dependencyGraph);
      }
    } catch { /* non-fatal */ }

    const knowledge: RepositoryKnowledge = {
      sourceFiles,
      dependencyGraph,
      architecture,
      builtAt: new Date().toISOString(),
    };

    this.persistAnalysis(id, knowledge, profile, entries);

    return knowledge;
  }

  private persistAnalysis(workspaceId: string, knowledge: RepositoryKnowledge, profile: WorkspaceProfile, entries?: ElectronDirectoryEntry[]): void {
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

    const entryMap = new Map(entries?.map(e => [e.relativePath, e]) ?? []);

    const syncEntries = knowledge.sourceFiles.map(f => {
      const entry = entryMap.get(f.path);
      return {
        relativePath: f.path,
        extension: f.extension,
        size: entry?.size ?? f.content.length,
        hash: hashContent(f.content),
        modifiedAt: entry?.modifiedAt ?? null,
      };
    });

    this.electron.syncFileMetadata(repositoryId, syncEntries)
      .catch(() => { /* non-fatal */ });
  }
}
