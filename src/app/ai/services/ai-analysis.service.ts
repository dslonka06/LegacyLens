import { Injectable } from '@angular/core';
import { Observable, from, catchError, throwError } from 'rxjs';
import { AiAnalysisResult } from '@app/analysis/models/ai-analysis-result.model';
import { ElectronService } from '@app/core/services/electron.service';

@Injectable({ providedIn: 'root' })
export class AiAnalysisService {
  constructor(private readonly electron: ElectronService) {}

  analyze(fileName: string, sourceCode: string): Observable<AiAnalysisResult> {
    return from(this.electron.aiAnalyze(fileName, sourceCode)).pipe(
      catchError((err: Error) => throwError(() => err)),
    ) as Observable<AiAnalysisResult>;
  }
}
