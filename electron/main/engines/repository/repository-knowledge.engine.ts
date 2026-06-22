// Types from: @app/knowledge/models/knowledge.model and related services
// Note: This engine strips Angular DI (inject/Injectable). WorkspaceManagerService
// is not available in the Electron main process — state management must be handled
// externally. This engine exposes the build logic as a plain async method.

import { DependencyMapperEngine, SourceFile, DependencyGraph } from './dependency-mapper.engine';
import { ArchitectureDetectorEngine, RepositoryArchitectureAnalysis } from '../architecture/architecture-detector.engine';

export enum KnowledgeState {
  NotStarted = 'NotStarted',
  ReadingFiles = 'ReadingFiles',
  BuildingDependencies = 'BuildingDependencies',
  DetectingArchitecture = 'DetectingArchitecture',
  Complete = 'Complete',
}

export interface RepositoryKnowledge {
  sourceFiles: SourceFile[];
  dependencyGraph?: DependencyGraph;
  architecture?: RepositoryArchitectureAnalysis;
  builtAt: string;
}

// Represents a workspace profile subset needed by the build method
export interface WorkspaceProfileSubset {
  repositoryStructure?: any;
}

export class RepositoryKnowledgeEngine {

  private readonly dependencyMapper: DependencyMapperEngine;
  private readonly architectureDetector: ArchitectureDetectorEngine;

  constructor(
    dependencyMapper: DependencyMapperEngine,
    architectureDetector: ArchitectureDetectorEngine,
  ) {
    this.dependencyMapper = dependencyMapper;
    this.architectureDetector = architectureDetector;
  }

  async build(
    sourceFiles: SourceFile[],
    profile: WorkspaceProfileSubset,
    onStateChange?: (state: KnowledgeState) => void,
  ): Promise<RepositoryKnowledge> {
    onStateChange?.(KnowledgeState.BuildingDependencies);
    let dependencyGraph: DependencyGraph | undefined;
    try {
      dependencyGraph = this.dependencyMapper.buildGraph(sourceFiles);
    } catch { /* non-fatal */ }

    onStateChange?.(KnowledgeState.DetectingArchitecture);
    let architecture: RepositoryArchitectureAnalysis | undefined;
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

    onStateChange?.(KnowledgeState.Complete);

    return knowledge;
  }
}
