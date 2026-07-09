import { Injectable } from '@angular/core';
import { ElectronService } from '@app/core/services/electron.service';
import type {
  KnowledgeModel,
  IncrementalCheckResult,
  AnalysisTargetType,
  ProcessWorkspaceRequest,
} from '../../../../electron';
import type { ElectronDirectoryEntry } from '../../../../electron';

@Injectable({ providedIn: 'root' })
export class WorkspaceKnowledgeService {

  constructor(private readonly electron: ElectronService) {}

  /**
   * Process a workspace end-to-end: validate → incremental check → pipeline → model build → persist.
   *
   * This is the primary entry point. Angular analysis pages call this instead of
   * individually calling runPipeline + buildKnowledgeModel.
   */
  async process(
    targetType: AnalysisTargetType,
    files: ElectronDirectoryEntry[],
    options: ProcessWorkspaceRequest['options'] = {},
  ): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;

    const request: ProcessWorkspaceRequest = {
      targetType,
      files: files.map(f => ({
        name:      f.name,
        path:      f.relativePath,
        extension: f.relativePath.includes('.') ? f.relativePath.split('.').pop() ?? '' : '',
        content:   f.content,
      })),
      options,
    };

    return this.electron.processWorkspace(request);
  }

  /**
   * Check whether an existing KnowledgeModel is current before scanning files.
   * Use this to decide whether to show "Already up to date" vs starting a full scan.
   */
  async checkIncremental(
    repositoryId: string,
    files: ElectronDirectoryEntry[],
    targetType: AnalysisTargetType,
  ): Promise<IncrementalCheckResult | null> {
    if (!this.electron.isElectron) return null;

    const currentFiles = files
      .filter(f => f.content !== null)
      .map(f => ({
        relativePath: f.relativePath,
        hash:         this.hashContent(f.content ?? ''),
      }));

    return this.electron.checkIncremental(repositoryId, currentFiles, targetType);
  }

  /**
   * Retrieve the most recently persisted KnowledgeModel for a repository.
   */
  async getLatest(repositoryId: string): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.getKnowledgeModel(repositoryId) as Promise<KnowledgeModel | null>;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private hashContent(content: string): string {
    // FNV-1a 32-bit — must match the hash in KnowledgeService.hashContent()
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }
}
