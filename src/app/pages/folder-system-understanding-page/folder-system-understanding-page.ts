import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { SystemUnderstanding } from '../../models/system-understanding.model';
import { ExplanationResult } from '../../models/ai-explanation-context.model';
import { ExplanationCard } from '../../components/explanation-card/explanation-card';

@Component({
  selector: 'app-folder-system-understanding-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ExplanationCard],
  templateUrl: './folder-system-understanding-page.html',
  styleUrl: './folder-system-understanding-page.scss',
})
export class FolderSystemUnderstandingPage implements OnInit, OnDestroy {

  understanding: SystemUnderstanding | null = null;
  hasWorkspace = false;
  aiExplanation: ExplanationResult | null = null;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.hasWorkspace = ws !== null;
      this.understanding = ws?.systemUnderstanding ?? null;
      this.aiExplanation = ws?.aiExplanation ?? null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismissExplanation(): void {
    const id = this.manager.activeId;
    if (id) this.manager.clearAiExplanation(id);
  }

  get showExplanationCard(): boolean {
    return this.hasWorkspace && this.aiExplanation !== null;
  }
}
