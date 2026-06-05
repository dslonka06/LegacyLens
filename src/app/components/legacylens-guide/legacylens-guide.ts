import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GuideQuestion, GuideRecommendation, RecommendedPage } from '../../models/guide.model';
import { GuideStateService } from '../../services/guide-state.service';
import { GuideEngineService } from '../../services/guide-engine.service';
import { CurrentWorkspaceService } from '../../services/current-workspace.service';

type GuideView = 'q1' | 'q2' | 'recommendation';

@Component({
  selector: 'app-legacylens-guide',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './legacylens-guide.html',
  styleUrl: './legacylens-guide.scss',
})
export class LegacyLensGuide implements OnInit {

  view: GuideView = 'q1';
  q1: GuideQuestion | null = null;
  q2: GuideQuestion | null = null;
  selectedQ1: string | null = null;
  selectedQ2: string | null = null;
  recommendation: GuideRecommendation | null = null;
  dontShowAgain = false;

  constructor(
    private readonly state: GuideStateService,
    private readonly engine: GuideEngineService,
    private readonly workspace: CurrentWorkspaceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.q1 = this.engine.getQuestion1();
    // If a completed recommendation exists, jump straight to it
    if (this.state.recommendation) {
      this.recommendation = this.state.recommendation;
      this.view = 'recommendation';
    }
  }

  selectQ1(optionId: string): void {
    this.selectedQ1 = optionId;

    if (this.engine.skipQuestion2(optionId)) {
      this.generateRecommendation();
    } else {
      this.q2 = this.engine.getQuestion2(optionId);
      this.view = 'q2';
    }
  }

  selectQ2(optionId: string): void {
    this.selectedQ2 = optionId;
    this.generateRecommendation();
  }

  private generateRecommendation(): void {
    const workspaceType = this.workspace.profile?.workspaceType;
    this.recommendation = this.engine.buildRecommendation(
      { q1: this.selectedQ1!, q2: this.selectedQ2 ?? undefined },
      workspaceType,
    );
    this.state.setRecommendation(this.recommendation);
    this.view = 'recommendation';
  }

  restart(): void {
    this.state.reset();
    this.selectedQ1 = null;
    this.selectedQ2 = null;
    this.recommendation = null;
    this.q2 = null;
    this.view = 'q1';
  }

  close(): void {
    this.state.dismiss(this.dontShowAgain);
  }

  navigateTo(page: RecommendedPage): void {
    this.state.close();
    this.router.navigate([page.route]);
  }

  back(): void {
    if (this.view === 'q2') {
      this.selectedQ1 = null;
      this.view = 'q1';
    } else if (this.view === 'recommendation') {
      this.state.reset();
      this.recommendation = null;
      if (this.engine.skipQuestion2(this.selectedQ1 ?? '')) {
        this.selectedQ1 = null;
        this.view = 'q1';
      } else {
        this.view = 'q2';
      }
    }
  }

  get currentQuestion(): GuideQuestion | null {
    return this.view === 'q1' ? this.q1 : this.q2;
  }

  get stepCount(): number {
    return this.recommendation?.steps.length ?? 0;
  }

  get progressLabel(): string {
    if (this.view === 'q1') return 'Step 1 of 2';
    if (this.view === 'q2') return 'Step 2 of 2';
    return 'Recommendation ready';
  }

  get showBack(): boolean {
    return this.view !== 'q1';
  }
}
