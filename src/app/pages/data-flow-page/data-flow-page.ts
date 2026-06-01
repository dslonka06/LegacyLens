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
    const raw = this.session.analysis.dataFlow;
    return raw.split(/→|->/).map(s => s.trim()).filter(s => s.length > 0);
  }
}
