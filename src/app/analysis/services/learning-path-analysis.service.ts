import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { LearningPathAnalysis } from '../models/learning-path-analysis.model';
import { SystemUnderstanding } from '../models/system-understanding.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class LearningPathAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyzeFile(session: AnalysisSession, understanding: SystemUnderstanding): Promise<LearningPathAnalysis> {
    return this.electron.intelligenceLearningPath(session, null, understanding, 'file') as Promise<LearningPathAnalysis>;
  }

  async analyzeKnowledge(
    knowledge: RepositoryKnowledge,
    session: AnalysisSession | null,
    understanding: SystemUnderstanding,
    scope: 'folder' | 'repository',
  ): Promise<LearningPathAnalysis> {
    return this.electron.intelligenceLearningPath(session, knowledge, understanding, scope) as Promise<LearningPathAnalysis>;
  }
}
