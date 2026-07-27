import { Injectable } from '@angular/core';
import { SystemUnderstanding } from '../models/system-understanding.model';
import { ElectronService } from '@app/core/services/electron.service';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

@Injectable({ providedIn: 'root' })
export class SystemUnderstandingService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(model: KnowledgeModel): Promise<SystemUnderstanding> {
    return this.electron.intelligenceSystemUnderstanding(model) as Promise<SystemUnderstanding>;
  }
}
