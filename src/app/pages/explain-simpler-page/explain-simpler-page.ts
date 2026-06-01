import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-explain-simpler-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './explain-simpler-page.html',
  styleUrl: './explain-simpler-page.scss'
})
export class ExplainSimplerPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }
}
