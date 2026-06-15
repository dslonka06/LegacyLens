import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-file-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-architecture-page.html',
  styleUrl: './file-architecture-page.scss'
})
export class FileArchitecturePage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  private sub: Subscription | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.sub = this.currentAnalysis.session$.subscribe(s => { this.session = s; });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get dependencies(): string[] {
    const arch = this.session?.aiAnalysis?.architecture;
    if (arch && arch.dependencies.length > 0) return arch.dependencies;
    return this.session?.analysis.dependencies ?? [];
  }

  get architectureNarrative(): string {
    return this.session?.aiAnalysis?.summary ?? this.session?.analysis.architecture ?? '';
  }

  get architectureLayers(): string[] {
    return this.session?.analysis.architectureLayers ?? [];
  }

  get inputs(): string[] {
    return this.session?.analysis.inputs ?? [];
  }

  get outputs(): string[] {
    return this.session?.analysis.outputs ?? [];
  }

}
