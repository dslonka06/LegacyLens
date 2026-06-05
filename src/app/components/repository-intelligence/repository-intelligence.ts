import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KnowledgeState, RepositoryKnowledge } from '../../models/knowledge.model';
import { DependencyMapperService } from '../../services/dependency-mapper.service';

interface ConnectedFile {
  name: string;
  degree: number;
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
  archExpanded = true;

  mostConnected: ConnectedFile[] = [];

  readonly KnowledgeState = KnowledgeState;

  constructor(private readonly mapper: DependencyMapperService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['knowledge'] && this.knowledge?.dependencyGraph) {
      this.mostConnected = this.mapper
        .mostConnected(this.knowledge.dependencyGraph, 5)
        .map(x => ({ name: x.node.name, degree: x.degree }));
    }
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

  get sourceFileCount(): number {
    return this.knowledge?.sourceFiles.length ?? 0;
  }

  get hasGraph(): boolean {
    return (this.knowledge?.dependencyGraph?.nodes.length ?? 0) > 0;
  }

  get hasArchitecture(): boolean {
    return (this.knowledge?.architecture?.patterns.length ?? 0) > 0;
  }

  get architecturePatterns() {
    return this.knowledge?.architecture?.patterns ?? [];
  }

  get hasContent(): boolean {
    return this.state !== KnowledgeState.NotStarted;
  }

  // Progress step helpers — keeps enum comparisons out of the template
  get step1Done(): boolean   { return this.state !== KnowledgeState.NotStarted; }
  get step1Active(): boolean { return this.state === KnowledgeState.ReadingFiles; }
  get step1Icon(): string    { return this.step1Active ? '⏳' : '✓'; }

  get step2Done(): boolean   { return this.state === KnowledgeState.DetectingArchitecture || this.state === KnowledgeState.Complete; }
  get step2Active(): boolean { return this.state === KnowledgeState.BuildingDependencies; }
  get step2Pending(): boolean { return this.state === KnowledgeState.ReadingFiles; }
  get step2Icon(): string    { return this.step2Active ? '⏳' : this.step2Done ? '✓' : '·'; }

  get step3Done(): boolean   { return this.state === KnowledgeState.Complete; }
  get step3Active(): boolean { return this.state === KnowledgeState.DetectingArchitecture; }
  get step3Pending(): boolean { return this.state === KnowledgeState.ReadingFiles || this.state === KnowledgeState.BuildingDependencies; }
  get step3Icon(): string    { return this.step3Active ? '⏳' : this.step3Done ? '✓' : '·'; }

  get isComplete(): boolean  { return this.state === KnowledgeState.Complete; }

  confidencePercent(confidence: number): number {
    return Math.round(confidence * 100);
  }

  confidenceClass(confidence: number): string {
    if (confidence >= 0.85) return 'conf-high';
    if (confidence >= 0.70) return 'conf-medium';
    return 'conf-low';
  }

  toggleDeps(): void { this.depsExpanded = !this.depsExpanded; }
  toggleArch(): void { this.archExpanded = !this.archExpanded; }
}
