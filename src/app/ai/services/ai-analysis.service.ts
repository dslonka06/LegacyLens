import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import { AiAnalysisResult } from '@app/analysis/models/ai-analysis-result.model';

interface AiAnalysisRequest {
  fileName: string;
  sourceCode: string;
}

@Injectable({ providedIn: 'root' })
export class AiAnalysisService {

  private readonly apiUrl = 'http://localhost:5000/api/ai/analyze';
  private readonly timeoutMs = 60_000; // AI calls can be slow

  constructor(private readonly http: HttpClient) {}

  analyze(fileName: string, sourceCode: string): Observable<AiAnalysisResult> {
    const body: AiAnalysisRequest = { fileName, sourceCode };

    return this.http.post<AiAnalysisResult>(this.apiUrl, body).pipe(
      timeout(this.timeoutMs),
      catchError((err: HttpErrorResponse | Error) => throwError(() => err))
    );
  }
}
