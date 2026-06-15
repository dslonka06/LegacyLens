import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';

@Component({
  selector: 'app-file-data-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-data-flow-page.html',
  styleUrl: './file-data-flow-page.scss'
})
export class FileDataFlowPage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  flowSteps: string[] = [];
  aiWorkflow: string | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.sub = this.currentAnalysis.session$.subscribe(s => {
      this.session = s;
      this.buildFlow(s);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private buildFlow(session: AnalysisSession | null): void {
    if (!session) { this.flowSteps = []; this.aiWorkflow = null; return; }

    // AI workflow narrative preferred; fall back to heuristic dataFlow text
    this.aiWorkflow = session.aiAnalysis?.documentation?.workflow
      ?? session.analysis?.dataFlow
      ?? null;

    // Pattern-based dataFlow string → numbered steps
    const raw = session.analysis?.dataFlow;
    this.flowSteps = raw
      ? raw.split(/→|->/).map(s => s.trim()).filter(Boolean)
      : [];
  }

  get isAiPowered(): boolean {
    return this.session?.aiAnalysis?.documentation?.workflow != null;
  }

  get inputs(): string[] {
    return this.session?.analysis?.inputs ?? [];
  }

  get outputs(): string[] {
    return this.session?.analysis?.outputs ?? [];
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }
}
