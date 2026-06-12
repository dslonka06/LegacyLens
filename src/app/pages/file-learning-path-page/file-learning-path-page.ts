import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { LearningPathAnalysis } from '../../models/learning-path-analysis.model';
import { Workspace } from '../../models/workspace-entity.model';

@Component({
  selector: 'app-file-learning-path-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-learning-path-page.html',
  styleUrl: './file-learning-path-page.scss',
})
export class FileLearningPathPage implements OnInit, OnDestroy {

  workspace: Workspace | null = null;
  get lp(): LearningPathAnalysis | null { return this.workspace?.learningPathAnalysis ?? null; }
  get hasWorkspace(): boolean { return this.workspace !== null && this.workspace.session !== null; }

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
