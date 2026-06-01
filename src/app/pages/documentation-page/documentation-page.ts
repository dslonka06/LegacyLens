import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-documentation-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './documentation-page.html',
  styleUrl: './documentation-page.scss'
})
export class DocumentationPage implements OnInit {

  session: AnalysisSession | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.session = this.currentAnalysis.getSession();
  }
}
