import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { RecommendationAnalysis } from '../models/recommendation-analysis.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class RecommendationAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyzeFile(session: AnalysisSession): Promise<RecommendationAnalysis> {
    return this.electron.intelligenceRecommendations(session, null) as Promise<RecommendationAnalysis>;
  }

  async analyzeKnowledge(knowledge: RepositoryKnowledge, session: AnalysisSession | null): Promise<RecommendationAnalysis> {
    return this.electron.intelligenceRecommendations(session, knowledge) as Promise<RecommendationAnalysis>;
  }
}
