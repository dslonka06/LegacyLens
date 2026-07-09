import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { AIAnalysisService } from '@app/analysis/services/ai-analysis.service';
import type { KnowledgeModel, AnalysisTargetType } from '@app/knowledge/models/knowledge-model.contract';
import type { ProcessWorkspaceRequest, ElectronDirectoryEntry } from '../../../electron';

export interface ProcessWorkspaceOptions {
  workspaceId:    string;           // required — used to update WorkspaceManagerService
  repositoryId?:  string;           // for SQLite persistence and incremental updates
  repositoryPath?: string;          // for git metadata (repository targets)
  workspaceName?: string;
  persist?:       boolean;
  incremental?:   boolean;
}

/**
 * WorkspaceKnowledgeService — the ONLY service allowed to construct or mutate a KnowledgeModel.
 *
 * Responsibilities:
 *   - Structural phase: calls D7 intelligence:processWorkspace, emits structural model immediately
 *   - Delegates AI phase to AIAnalysisService (which merges results back via WorkspaceManagerService)
 *   - Updates workspace status via WorkspaceManagerService at each phase transition
 *
 * Hub pages call process() and subscribe. They do not touch WorkspaceManagerService directly
 * for knowledge state — this service owns that.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceKnowledgeService {

  constructor(
    private readonly electron:    ElectronService,
    private readonly manager:     WorkspaceManagerService,
    private readonly aiAnalysis:  AIAnalysisService,
  ) {}

  /**
   * Process a workspace through the full pipeline.
   *
   * Emits:
   *   1. The structural KnowledgeModel as soon as Code Intelligence Engine completes.
   *   2. Updated models as each AI stage merges in (via WorkspaceManagerService.activeWorkspace$).
   *
   * Hub pages subscribe to manager.activeWorkspace$ for live updates.
   * This method's observable completes after the structural model is emitted and AI is kicked off.
   */
  process(
    targetType:  AnalysisTargetType,
    files:       ElectronDirectoryEntry[],
    options:     ProcessWorkspaceOptions,
  ): Observable<KnowledgeModel> {
    const subject = new Subject<KnowledgeModel>();

    this.manager.setProcessing(options.workspaceId);

    const request: ProcessWorkspaceRequest = {
      targetType,
      files: files.map(f => ({
        name:      f.name,
        path:      f.relativePath,
        extension: f.relativePath.includes('.') ? f.relativePath.split('.').pop() ?? '' : '',
        content:   f.content,
      })),
      options: {
        repositoryId:   options.repositoryId,
        repositoryPath: options.repositoryPath,
        workspaceName:  options.workspaceName,
        persist:        options.persist,
        incremental:    options.incremental,
      },
    };

    // Run structural pipeline async, emit result immediately when done
    this.runStructuralPhase(request, options, subject);

    return subject.asObservable();
  }

  /**
   * Retrieve the most recently persisted KnowledgeModel for a repository.
   * Used by hub pages during cache restore before calling process().
   */
  async getLatest(repositoryId: string): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.getKnowledgeModel(repositoryId) as Promise<KnowledgeModel | null>;
  }

  // ── Private pipeline ──────────────────────────────────────────────────────

  private async runStructuralPhase(
    request: ProcessWorkspaceRequest,
    options: ProcessWorkspaceOptions,
    subject: Subject<KnowledgeModel>,
  ): Promise<void> {
    try {
      if (!this.electron.isElectron) {
        subject.error(new Error('WorkspaceKnowledgeService requires Electron'));
        return;
      }

      const model = await this.electron.processWorkspace(request);
      if (!model) throw new Error('processWorkspace returned null');

      // Persist repository link if returned
      if (model.metadata.buildId && options.repositoryId) {
        this.manager.setRepositoryId(options.workspaceId, options.repositoryId);
      }

      this.manager.setKnowledgeModel(options.workspaceId, model);
      subject.next(model);
      subject.complete();

      // Kick off AI pipeline in the background — results merge into the workspace
      // via WorkspaceManagerService.mergeAIResults() as each stage completes.
      // Hub pages observe manager.activeWorkspace$ and re-render reactively.
      this.aiAnalysis.runAll(options.workspaceId, model).catch(() => {
        // Individual stage failures are handled inside runAll — this catch is
        // only for unexpected errors in the orchestration itself.
      });

    } catch (err) {
      this.manager.setError(options.workspaceId);
      subject.error(err);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  hashContent(content: string): string {
    // FNV-1a 32-bit — must match KnowledgeService.hashContent() on the Electron side
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash  = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }
}
