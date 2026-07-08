import { Injectable } from '@angular/core';
import { AnalysisResult } from '../models/analysis-result.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  constructor(private readonly electron: ElectronService) {}

  async analyze(code: string): Promise<AnalysisResult> {
    return this.electron.intelligenceAnalyzeCode(code) as Promise<AnalysisResult>;
  }
}
