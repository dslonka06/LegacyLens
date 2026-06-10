import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrentAnalysisService } from '../../services/current-analysis.service';
import { AnalysisSession } from '../../models/analysis-session.model';

@Component({
  selector: 'app-file-data-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-data-flow-page.html',
  styleUrl: './file-data-flow-page.scss'
})
export class FileDataFlowPage implements OnInit {

  session: AnalysisSession | null = null;
  flowSteps: string[] = [];

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
    if (this.session?.analysis?.dataFlow) {
      this.flowSteps = this.session.analysis.dataFlow
        .split(/→|->/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  getStepClass(index: number, total: number): string {
    if (index === 0) return 'step-first';
    if (index === total - 1) return 'step-last';
    return 'step-mid';
  }
}
