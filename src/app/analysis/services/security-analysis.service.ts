import { Injectable } from '@angular/core';
import { SecurityAnalysis } from '../models/security-analysis.model';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Injectable({ providedIn: 'root' })
export class SecurityAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(model: KnowledgeModel): Promise<SecurityAnalysis> {
    return this.electron.intelligenceSecurity(model) as Promise<SecurityAnalysis>;
  }
}
