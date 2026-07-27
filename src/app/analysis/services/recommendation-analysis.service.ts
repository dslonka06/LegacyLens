import { Injectable } from '@angular/core';
import { RecommendationAnalysis } from '../models/recommendation-analysis.model';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Injectable({ providedIn: 'root' })
export class RecommendationAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(model: KnowledgeModel): Promise<RecommendationAnalysis> {
    return this.electron.intelligenceRecommendations(model) as Promise<RecommendationAnalysis>;
  }
}
