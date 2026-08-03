import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import { MermaidDiagram } from '@app/shared/components/mermaid-diagram/mermaid-diagram';
import type {
  KnowledgeModel,
  ArchitecturePattern,
  DependencyHub,
} from '@app/knowledge/models/knowledge-model.contract';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

@Component({
  selector: 'app-architecture-page',
  standalone: true,
  imports: [CommonModule, ThemeToggle, ExplanationCard, MermaidDiagram],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.scss',
})
export class ArchitecturePage implements OnInit, OnDestroy {
  model: KnowledgeModel | null = null;
  hasWorkspace = false;
  hubNodesExpanded = false;
  showArchSummaryInfo = false;
  showLayerDiagramInfo = false;
  showStructuralInfo = false;
  showHubNodesInfo = false;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.model = this.manager.getActive()?.knowledgeModel ?? null;
    this.hasWorkspace = this.model != null;
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.model = ws?.knowledgeModel ?? null;
      this.hasWorkspace = this.model != null;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleHubNodes(): void {
    this.hubNodesExpanded = !this.hubNodesExpanded;
  }

  get patterns(): ArchitecturePattern[] {
    return this.model?.relationships.architecture?.patterns ?? [];
  }

  get workspaceName(): string {
    return this.model?.workspaceName ?? 'Workspace';
  }

  get architectureNarrative(): string {
    const pts = this.patterns;
    if (!pts.length) return '';
    const names = pts.slice(0, 3).map((p) => p.name).join(', ');
    const topConf = this.confidencePercent(pts[0]);
    return `Detected pattern${pts.length > 1 ? 's' : ''}: ${names} (${topConf}% confidence).`;
  }

  confidencePercent(p: ArchitecturePattern): number {
    return Math.round((p.confidence ?? 0) * 100);
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.model?.ai?.summaries?.architecture ?? null;
  }

  get architectureDiagram(): string | null {
    return this.model?.ai?.architecture?.architectureDiagram ?? null;
  }

  get archAI(): ArchitectureAIAnalysis | null {
    return this.model?.ai?.architecture ?? null;
  }

  get hubNodes(): DependencyHub[] {
    return (this.model?.relationships.dependencies?.hubs ?? []).filter(h => h.isHub).slice(0, 10);
  }

  get hasStructuralAnalysis(): boolean {
    return this.archAI != null;
  }

  couplingClass(assessment: string): string {
    return { Low: 'coupling-low', Moderate: 'coupling-moderate', High: 'coupling-high', Critical: 'coupling-critical' }[assessment] ?? 'coupling-low';
  }

  architectureDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'Clean Architecture':
        'Business logic isolated from infrastructure. Dependencies point inward.',
      MVC: 'Model, View, Controller separation — each layer has a distinct role.',
      CQRS: 'Read and write operations handled separately. Queries and commands are decoupled.',
      'Layered Architecture':
        'Code organised into horizontal layers: presentation, business logic, data access.',
      'Microservice Architecture': 'Independently deployable services, each owning its own data.',
      'Feature-Sliced Design': 'Code grouped by feature slice rather than by technical layer.',
      'Hexagonal Architecture': 'Application core surrounded by ports and adapters.',
    };
    return (
      descriptions[name] ??
      'Architectural pattern detected from folder structure and dependency analysis.'
    );
  }
}
