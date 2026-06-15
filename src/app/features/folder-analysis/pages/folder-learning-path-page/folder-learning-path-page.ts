import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import { Workspace } from '@app/workspace/models/workspace-entity.model';

@Component({
  selector: 'app-folder-learning-path-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './folder-learning-path-page.html',
  styleUrl: './folder-learning-path-page.scss',
})
export class FolderLearningPathPage implements OnInit, OnDestroy {

  workspace: Workspace | null = null;
  get lp(): LearningPathAnalysis | null { return this.workspace?.learningPathAnalysis ?? null; }
  get hasWorkspace(): boolean { return this.workspace !== null && this.workspace.knowledge !== null; }

  expandedSteps = new Set<number>();

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.workspace = this.manager.getActive();
    this.sub = this.manager.activeWorkspace$.subscribe(ws => { this.workspace = ws; });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  toggleStep(n: number): void {
    if (this.expandedSteps.has(n)) this.expandedSteps.delete(n);
    else this.expandedSteps.add(n);
  }

  isStepExpanded(n: number): boolean { return this.expandedSteps.has(n); }
}
