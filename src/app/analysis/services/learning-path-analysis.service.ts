import { Injectable } from '@angular/core';
import { LearningPathAnalysis } from '../models/learning-path-analysis.model';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Injectable({ providedIn: 'root' })
export class LearningPathAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(model: KnowledgeModel): Promise<LearningPathAnalysis> {
    return this.electron.intelligenceLearningPath(model, null, null, model.targetType) as Promise<LearningPathAnalysis>;
  }
}
