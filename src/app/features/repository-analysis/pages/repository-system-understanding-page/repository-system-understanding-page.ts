import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { ExplanationResult } from '@app/analysis/models/ai-explanation-context.model';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';

@Component({
  selector: 'app-repository-system-understanding-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ExplanationCard],
  templateUrl: './repository-system-understanding-page.html',
  styleUrl: './repository-system-understanding-page.scss',
})
export class RepositorySystemUnderstandingPage implements OnInit, OnDestroy {

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

  depTypeLabel(type: string): string {
    const map: Record<string, string> = {
      framework: 'Framework',
      database:  'Database',
      queue:     'Queue',
      storage:   'Storage',
      external:  'External',
      internal:  'Internal',
    };
    return map[type] ?? type;
  }
}
