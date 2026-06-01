import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-data-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './data-flow-page.html',
  styleUrl: './data-flow-page.scss'
})
export class DataFlowPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }

  get flowSteps(): string[] {
    if (!this.session) return [];
    return this.session.analysis.dataFlow
      .split(/→|->/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }
}
