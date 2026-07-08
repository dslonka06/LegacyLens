import { Injectable } from '@angular/core';
import { WorkspaceContext } from '@app/workspace/models/workspace-context.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { AnalysisSession } from '../models/analysis-session.model';
import { RepositorySummary } from '../models/repository-summary.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class RepositorySummaryService {
  constructor(private readonly electron: ElectronService) {}

  async build(
    workspaceContext: WorkspaceContext | null,
    knowledge: RepositoryKnowledge | null,
    session: AnalysisSession | null,
  ): Promise<RepositorySummary> {
    return this.electron.intelligenceBuildSummary(workspaceContext, knowledge, session) as Promise<RepositorySummary>;
  }
}
