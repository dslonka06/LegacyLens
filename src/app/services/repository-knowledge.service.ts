import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { KnowledgeState, RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { FileContentService } from './file-content.service';
import { DependencyMapperService } from './dependency-mapper.service';
import { ArchitectureDetectorService } from './architecture-detector.service';

@Injectable({ providedIn: 'root' })
export class RepositoryKnowledgeService {

  private readonly _state$ = new BehaviorSubject<KnowledgeState>(KnowledgeState.NotStarted);
  private readonly _knowledge$ = new BehaviorSubject<RepositoryKnowledge | null>(null);

  readonly state$ = this._state$.asObservable();
  readonly knowledge$ = this._knowledge$.asObservable();

  get state(): KnowledgeState { return this._state$.value; }
  get knowledge(): RepositoryKnowledge | null { return this._knowledge$.value; }

  constructor(
    private readonly fileContent: FileContentService,
    private readonly dependencyMapper: DependencyMapperService,
    private readonly architectureDetector: ArchitectureDetectorService,
  ) {}

  // Clears knowledge state — called when the workspace is cleared.
  clear(): void {
    this._state$.next(KnowledgeState.NotStarted);
    this._knowledge$.next(null);
  }

  // Builds RepositoryKnowledge from raw files and workspace profile.
  // Returns the completed knowledge object and emits it to subscribers.
  // Individual stage failures degrade gracefully — a failed dependency
  // build still yields source files, and a failed architecture detection
  // still yields the dependency graph.
  async build(
    rawFiles: File[],
    profile: WorkspaceProfile
  ): Promise<RepositoryKnowledge> {

    // ── Stage 3A: File Content Acquisition ───────────────────────────────────
    this._state$.next(KnowledgeState.ReadingFiles);
    const sourceFiles = await this.fileContent.readFiles(rawFiles);

    // ── Stage 3B: Dependency Mapping ─────────────────────────────────────────
    this._state$.next(KnowledgeState.BuildingDependencies);
    let dependencyGraph = undefined;
    try {
      dependencyGraph = this.dependencyMapper.buildGraph(sourceFiles);
    } catch {
      // Non-fatal: proceed without graph
    }

    // ── Stage 3C: Architecture Detection ─────────────────────────────────────
    this._state$.next(KnowledgeState.DetectingArchitecture);
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

    this._state$.next(KnowledgeState.Complete);
    this._knowledge$.next(knowledge);

    return knowledge;
  }
}
