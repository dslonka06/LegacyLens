import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KnowledgeState, RepositoryKnowledge } from '../../models/knowledge.model';
import { DependencyExplorerService, FileRanking } from '../../services/dependency-explorer.service';

export interface KeyComponent {
  ranking: FileRanking;
  role: string;
  roleClass: string;
  description: string;
}

@Component({
  selector: 'app-repository-intelligence',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repository-intelligence.html',
  styleUrl: './repository-intelligence.scss',
})
export class RepositoryIntelligence implements OnChanges {

  @Input() knowledge: RepositoryKnowledge | null = null;
  @Input() state: KnowledgeState = KnowledgeState.NotStarted;

  depsExpanded = true;

  keyComponents: KeyComponent[] = [];

  readonly KnowledgeState = KnowledgeState;

  constructor(private readonly explorer: DependencyExplorerService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['knowledge'] && this.knowledge?.dependencyGraph) {
      const rankings = this.explorer.rankByConnectivity(this.knowledge.dependencyGraph, 8);
      this.keyComponents = rankings.map(r => this.toKeyComponent(r));
    }
  }

  private toKeyComponent(r: FileRanking): KeyComponent {
    const inRatio = r.total > 0 ? r.inbound / r.total : 0;

    let role: string;
    let roleClass: string;
    let description: string;

    if (r.inbound >= 6 && r.outbound >= 6) {
      role = 'System Hub';
      roleClass = 'role-hub';
      description = `Used by ${r.inbound} files, depends on ${r.outbound}. Central to multiple workflows.`;
    } else if (inRatio >= 0.65 && r.inbound >= 4) {
      role = 'Widely Used';
      roleClass = 'role-used';
      description = `Referenced by ${r.inbound} other files. Changes here have a broad blast radius.`;
    } else if (inRatio <= 0.35 && r.outbound >= 5) {
      role = 'Broad Scope';
      roleClass = 'role-broad';
      description = `Depends on ${r.outbound} other files. Orchestrates or aggregates across many concerns.`;
    } else {
      role = 'Connected';
      roleClass = 'role-connected';
      description = `${r.inbound} inbound, ${r.outbound} outbound connections.`;
    }

    return { ranking: r, role, roleClass, description };
  }

  get isBuilding(): boolean {
    return this.state === KnowledgeState.ReadingFiles
      || this.state === KnowledgeState.BuildingDependencies
      || this.state === KnowledgeState.DetectingArchitecture;
  }

  get stateLabel(): string {
    const labels: Record<KnowledgeState, string> = {
      [KnowledgeState.NotStarted]:           'Not started',
      [KnowledgeState.ReadingFiles]:          'Reading files…',
      [KnowledgeState.BuildingDependencies]:  'Building dependency graph…',
      [KnowledgeState.DetectingArchitecture]: 'Detecting architecture…',
      [KnowledgeState.Complete]:              'Complete',
      [KnowledgeState.Failed]:               'Analysis failed',
    };
    return labels[this.state] ?? '';
  }

  get nodeCount(): number {
    return this.knowledge?.dependencyGraph?.nodes.length ?? 0;
  }

  get edgeCount(): number {
    return this.knowledge?.dependencyGraph?.edges.length ?? 0;
  }

  get hasGraph(): boolean {
    return (this.knowledge?.dependencyGraph?.nodes.length ?? 0) > 0;
  }

  get hasContent(): boolean {
    return this.state !== KnowledgeState.NotStarted;
  }

  // Progress step helpers — keeps enum comparisons out of the template
  get step1Done(): boolean    { return this.state !== KnowledgeState.NotStarted; }
  get step1Active(): boolean  { return this.state === KnowledgeState.ReadingFiles; }
  get step1Icon(): string     { return this.step1Active ? '⏳' : '✓'; }

  get step2Done(): boolean    { return this.state === KnowledgeState.DetectingArchitecture || this.state === KnowledgeState.Complete; }
  get step2Active(): boolean  { return this.state === KnowledgeState.BuildingDependencies; }
  get step2Pending(): boolean { return this.state === KnowledgeState.ReadingFiles; }
  get step2Icon(): string     { return this.step2Active ? '⏳' : this.step2Done ? '✓' : '·'; }

  get step3Done(): boolean    { return this.state === KnowledgeState.Complete; }
  get step3Active(): boolean  { return this.state === KnowledgeState.DetectingArchitecture; }
  get step3Pending(): boolean { return this.state === KnowledgeState.ReadingFiles || this.state === KnowledgeState.BuildingDependencies; }
  get step3Icon(): string     { return this.step3Active ? '⏳' : this.step3Done ? '✓' : '·'; }

  get isComplete(): boolean   { return this.state === KnowledgeState.Complete; }

  toggleDeps(): void { this.depsExpanded = !this.depsExpanded; }
}
