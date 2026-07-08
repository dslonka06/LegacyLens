import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { SystemUnderstanding } from '../models/system-understanding.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class SystemUnderstandingService {
  constructor(private readonly electron: ElectronService) {}

  async analyzeFile(session: AnalysisSession): Promise<SystemUnderstanding> {
    return this.electron.intelligenceSystemUnderstanding(session, null) as Promise<SystemUnderstanding>;
  }

  async analyzeKnowledge(knowledge: RepositoryKnowledge, session: AnalysisSession | null): Promise<SystemUnderstanding> {
    return this.electron.intelligenceSystemUnderstanding(session, knowledge) as Promise<SystemUnderstanding>;
  }
}
