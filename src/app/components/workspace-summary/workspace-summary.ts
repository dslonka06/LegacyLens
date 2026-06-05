import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceProfile, WorkspaceType } from '../../models/workspace.model';

@Component({
  selector: 'app-workspace-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workspace-summary.html',
  styleUrl: './workspace-summary.scss',
})
export class WorkspaceSummary {

  @Input() profile: WorkspaceProfile | null = null;

  get workspaceTypeLabel(): string {
    const labels: Record<WorkspaceType, string> = {
      SingleFile:  'Single File',
      MultiFile:   'Multi-File',
      Project:     'Project',
      Repository:  'Repository',
    };
    return this.profile ? labels[this.profile.workspaceType] : '';
  }

  get confidencePercent(): number {
    return this.profile ? Math.round(this.profile.classificationConfidence * 100) : 0;
  }

  get typeIconClass(): string {
    const map: Record<WorkspaceType, string> = {
      SingleFile:  'icon-single',
      MultiFile:   'icon-multi',
      Project:     'icon-project',
      Repository:  'icon-repo',
    };
    return this.profile ? map[this.profile.workspaceType] : '';
  }
}
