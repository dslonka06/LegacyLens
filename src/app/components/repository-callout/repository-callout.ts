import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkspaceContext } from '../../models/workspace-context.model';

@Component({
  selector: 'app-repository-callout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repository-callout.html',
  styleUrl: './repository-callout.scss',
})
export class RepositoryCallout {

  @Input() context: WorkspaceContext | null = null;

  constructor(private readonly router: Router) {}

  get projectCount(): number {
    return this.context?.profile.repositoryStructure?.projects.length ?? 0;
  }

  get fileCount(): number {
    return this.context?.profile.totalFiles ?? 0;
  }

  get techSummary(): string {
    const techs = this.context?.profile.detectedTechnologies
      ?.filter(t => t.category === 'Framework' || t.category === 'Runtime')
      .slice(0, 3)
      .map(t => t.technology) ?? [];
    return techs.join(', ') || this.context?.profile.technologies.slice(0, 3).join(', ') || '';
  }

  get workspaceName(): string {
    return this.context?.workspaceName ?? 'Repository';
  }

  openRepositoryAnalysis(): void {
    this.router.navigate(['/repository-analysis']);
  }
}
