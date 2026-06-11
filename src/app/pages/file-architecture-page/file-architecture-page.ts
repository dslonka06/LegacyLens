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

  get isAiPowered(): boolean {
    const arch = this.session?.aiAnalysis?.architecture;
    return !!(arch && (arch.patterns.length > 0 || arch.responsibilities.length > 0 || arch.dependencies.length > 0));
  }

  get patterns(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.patterns;
    return this.session?.analysis.patterns ?? [];
  }

  get responsibilities(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.responsibilities;
    return this.session?.analysis.responsibilities ?? [];
  }

  get dependencies(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.dependencies;
    return this.session?.analysis.dependencies ?? [];
  }
}
