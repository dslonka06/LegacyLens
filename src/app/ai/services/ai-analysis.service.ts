import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, catchError, throwError, timeout, map } from 'rxjs';
import { AiAnalysisResult } from '@app/analysis/models/ai-analysis-result.model';
import { ElectronService } from '@app/core/services/electron.service';

interface AiAnalysisRequest {
  fileName: string;
  sourceCode: string;
}

@Injectable({ providedIn: 'root' })
export class AiAnalysisService {

  private readonly apiUrl = 'http://localhost:5000/api/ai/analyze';
  private readonly timeoutMs = 300_000; // 5 min — matches backend CTS

  constructor(
    private readonly http: HttpClient,
    private readonly electron: ElectronService,
  ) {}

  analyze(fileName: string, sourceCode: string): Observable<AiAnalysisResult> {
    if (this.electron.isElectron) {
      return from(this.electron.aiAnalyze(fileName, sourceCode)).pipe(
        map(result => result as AiAnalysisResult),
        catchError((err: Error) => throwError(() => err)),
      );
    }

    const body: AiAnalysisRequest = { fileName, sourceCode };
    return this.http.post<AiAnalysisResult>(this.apiUrl, body).pipe(
      timeout(this.timeoutMs),
      catchError((err: HttpErrorResponse | Error) => throwError(() => err)),
    );
  }
}
