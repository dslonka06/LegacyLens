import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel, AnalysisTargetType } from '../../../electron';

export interface KnowledgeModelBuildOptions {
  repositoryPath?: string;
  workspaceName?: string;
  repositoryId?: string;
  persist?: boolean;
}

@Injectable({ providedIn: 'root' })
export class KnowledgeModelService {
  constructor(private readonly electron: ElectronService) {}

  /**
   * Build a KnowledgeModel from a file list.
   *
   * In Electron: runs the full D2/D3/D4 pipeline in the main process and
   * returns the structured model. Optionally persists to SQLite when
   * options.persist and options.repositoryId are provided.
   *
   * In browser: returns null — the browser has no filesystem access.
   */
  async build(
    targetType: AnalysisTargetType,
    files: unknown[],
    options: KnowledgeModelBuildOptions = {},
  ): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.buildKnowledgeModel(
      targetType,
      files,
      options,
    ) as Promise<KnowledgeModel | null>;
  }

  /**
   * Retrieve the most recently persisted KnowledgeModel for a repository.
   * Returns null if none exists or not running in Electron.
   */
  async getLatest(repositoryId: string): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.getKnowledgeModel(repositoryId) as Promise<KnowledgeModel | null>;
  }

  /**
   * Adapt a KnowledgeModel into the RepositoryKnowledge shape that existing
   * analysis services (SystemUnderstanding, Security, Recommendations, etc.)
   * consume. Allows D4 output to flow through the existing pipeline without
   * breaking any consumers before D7 completes the full cutover.
   */
  toRepositoryKnowledge(model: KnowledgeModel) {
    return {
      dependencyGraph: model.relationships.dependencies?.graph ?? undefined,
      architecture: model.relationships.architecture ?? undefined,
      builtAt: model.metadata.builtAt,
    };
  }
}
