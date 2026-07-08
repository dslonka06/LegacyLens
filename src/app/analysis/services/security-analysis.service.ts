import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { SecurityAnalysis } from '../models/security-analysis.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class SecurityAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyzeFile(session: AnalysisSession): Promise<SecurityAnalysis> {
    return this.electron.intelligenceSecurity(session, null) as Promise<SecurityAnalysis>;
  }

  async analyzeKnowledge(knowledge: RepositoryKnowledge, session: AnalysisSession | null): Promise<SecurityAnalysis> {
    return this.electron.intelligenceSecurity(session, knowledge) as Promise<SecurityAnalysis>;
  }
}
