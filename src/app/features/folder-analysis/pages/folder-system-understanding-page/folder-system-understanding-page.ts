import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';

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

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.hasWorkspace = ws !== null;
      this.understanding = ws?.knowledgeModel?.ai?.understanding ?? null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismissExplanation(): void {
    // Explanation dismissal is no longer supported — it lives inside KnowledgeModel.
  }

  get showExplanationCard(): boolean {
    return this.hasWorkspace && this.understanding !== null;
  }
}
