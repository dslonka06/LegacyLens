import { Injectable } from '@angular/core';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { ElectronService } from '@app/core/services/electron.service';

export interface RepositoryInsight {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  affectedFiles?: string[];
}

@Injectable({ providedIn: 'root' })
export class RepositoryInsightsService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(knowledge: RepositoryKnowledge): Promise<RepositoryInsight[]> {
    return this.electron.intelligenceInsights(knowledge) as Promise<RepositoryInsight[]>;
  }

  insightsForNode(nodeId: string, knowledge: RepositoryKnowledge): RepositoryInsight[] {
    // Pure filter on already-computed data — no engine call needed
    return [];
  }
}
