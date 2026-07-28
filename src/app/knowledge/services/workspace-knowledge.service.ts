import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ElectronService } from '@app/core/services/electron.service';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { AIAnalysisService } from '@app/analysis/services/ai-analysis.service';
import type {
  KnowledgeModel,
  AnalysisTargetType,
} from '@app/knowledge/models/knowledge-model.contract';
import type { ProcessWorkspaceRequest, ElectronDirectoryEntry } from '../../../electron';

export interface ProcessWorkspaceOptions {
  workspaceId: string; // required — used to update WorkspaceManagerService
  repositoryId?: string; // for SQLite persistence and incremental updates
  repositoryPath?: string; // for git metadata (repository targets)
  workspaceName?: string;
  persist?: boolean;
  incremental?: boolean;
}

// Last-known inputs per workspace — needed to re-run the pipeline without re-uploading files.
interface WorkspaceInputCache {
  targetType: AnalysisTargetType;
  files: ElectronDirectoryEntry[];
  options: ProcessWorkspaceOptions;
}

/**
 * WorkspaceKnowledgeService — the ONLY service allowed to construct or mutate a KnowledgeModel.
 *
 * Responsibilities:
 *   - Structural phase: calls D7 intelligence:processWorkspace, emits structural model immediately
 *   - Delegates AI phase to AIAnalysisService (which merges results back via WorkspaceManagerService)
 *   - Updates workspace status via WorkspaceManagerService at each phase transition
 *   - Supports re-analyze: replays the last inputs for a workspace on demand
 *   - Supports cancel: increments the generation so in-flight AI results are discarded
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceKnowledgeService {
  // Cached inputs per workspace — kept so re-analyze can replay without re-uploading.
  private readonly _inputCache = new Map<string, WorkspaceInputCache>();

  constructor(
    private readonly electron: ElectronService,
    private readonly manager: WorkspaceManagerService,
    private readonly aiAnalysis: AIAnalysisService,
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
    targetType: AnalysisTargetType,
    files: ElectronDirectoryEntry[],
    options: ProcessWorkspaceOptions,
  ): Observable<KnowledgeModel> {
    this._inputCache.set(options.workspaceId, { targetType, files, options });
    return this.runPipeline(targetType, files, options);
  }

  /**
   * Re-run the full pipeline for a workspace using its cached inputs.
   * Clears the existing KnowledgeModel and AI results first.
   * No-op if the workspace has no cached inputs (user never uploaded files in this session).
   */
  reanalyze(workspaceId: string): Observable<KnowledgeModel> | null {
    const cached = this._inputCache.get(workspaceId);
    if (!cached) return null;

    // Cancel any in-flight AI results from the previous run
    this.manager.nextGeneration(workspaceId);
    this.manager.clearAllStages(workspaceId);
    this.manager.clearKnowledgeModel(workspaceId);

    return this.runPipeline(cached.targetType, cached.files, cached.options);
  }

  /**
   * Cancel any running AI pipeline for a workspace.
   * Structural phase (Electron IPC) cannot be interrupted, but its result will be discarded.
   * In-flight AI stage results are dropped via generation check.
   */
  cancelAnalysis(workspaceId: string): void {
    this.manager.nextGeneration(workspaceId);
    this.manager.clearAllStages(workspaceId);
    if (this.manager.getById(workspaceId)?.status === 'processing') {
      this.manager.setError(workspaceId);
    }
  }

  /**
   * Retrieve the most recently persisted KnowledgeModel for a repository.
   * Used by hub pages during cache restore before calling process().
   */
  async getLatest(repositoryId: string): Promise<KnowledgeModel | null> {
    if (!this.electron.isElectron) return null;
    return this.electron.getKnowledgeModel(repositoryId) as Promise<KnowledgeModel | null>;
  }

  canReanalyze(workspaceId: string): boolean {
    if (this._inputCache.has(workspaceId)) return true;
    const ws = this.manager.getById(workspaceId);
    return !!(ws?.path);
  }

  // ── Private pipeline ──────────────────────────────────────────────────────

  private runPipeline(
    targetType: AnalysisTargetType,
    files: ElectronDirectoryEntry[],
    options: ProcessWorkspaceOptions,
  ): Observable<KnowledgeModel> {
    const subject = new Subject<KnowledgeModel>();
    const generation = this.manager.nextGeneration(options.workspaceId);
    this.manager.setProcessing(options.workspaceId);

    const request: ProcessWorkspaceRequest = {
      targetType,
      files: files.map((f) => ({
        name: f.name,
        path: f.relativePath,
        extension: f.relativePath.includes('.') ? (f.relativePath.split('.').pop() ?? '') : '',
        content: f.content,
      })),
      options: {
        repositoryId: options.repositoryId,
        repositoryPath: options.repositoryPath,
        workspaceName: options.workspaceName,
        persist: options.persist,
        incremental: options.incremental,
      },
    };

    this.runStructuralPhase(request, options, subject, generation);
    return subject.asObservable();
  }

  private async runStructuralPhase(
    request: ProcessWorkspaceRequest,
    options: ProcessWorkspaceOptions,
    subject: Subject<KnowledgeModel>,
    generation: number,
  ): Promise<void> {
    try {
      if (!this.electron.isElectron) {
        subject.error(new Error('WorkspaceKnowledgeService requires Electron'));
        return;
      }

      const model = await this.electron.processWorkspace(request);
      if (!model) throw new Error('processWorkspace returned null');

      // Discard if a re-analyze was triggered while the structural phase was running
      if (this.manager.getGeneration(options.workspaceId) !== generation) {
        subject.complete();
        return;
      }

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
      this.aiAnalysis.runAll(options.workspaceId, model, generation).catch(() => {
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
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }
}
