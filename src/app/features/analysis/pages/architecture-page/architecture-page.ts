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
  showLayerDiagramInfo = false;
  showFileRolesInfo = false;
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

  get isRepoScope(): boolean {
    return this.model?.targetType === 'repository';
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

  get hubNodes(): DependencyHub[] {
    return (this.model?.relationships.dependencies?.hubs ?? []).filter(h => h.isHub).slice(0, 10);
  }

  private static readonly ROLE_ORDER = ['controller', 'service', 'state-store', 'component', 'http-client', 'repository'];

  get fileRoles(): Array<{ name: string; path: string; shortPath: string; fileRole: string; narrative: string }> {
    return this.model?.ai?.dataFlow?.fileRoles ?? [];
  }

  get fileRoleGroups(): Array<{ role: string; count: number; files: Array<{ name: string; path: string; shortPath: string; fileRole: string; narrative: string }> }> {
    const grouped: Record<string, Array<{ name: string; path: string; shortPath: string; fileRole: string; narrative: string }>> = {};
    for (const f of this.fileRoles) {
      (grouped[f.fileRole] ??= []).push(f);
    }
    return ArchitecturePage.ROLE_ORDER
      .filter(role => grouped[role]?.length)
      .map(role => ({ role, count: grouped[role].length, files: grouped[role] }));
  }

  private expandedRoleGroups = new Set<string>();

  toggleRoleGroup(role: string): void {
    if (this.expandedRoleGroups.has(role)) {
      this.expandedRoleGroups.delete(role);
    } else {
      this.expandedRoleGroups.add(role);
    }
  }

  isRoleGroupExpanded(role: string): boolean {
    return this.expandedRoleGroups.has(role);
  }

  roleClass(role: string): string {
    const map: Record<string, string> = {
      controller:    'role-controller',
      service:       'role-service',
      repository:    'role-repository',
      'http-client': 'role-http-client',
      'state-store': 'role-state-store',
      component:     'role-component',
    };
    return map[role] ?? 'role-unknown';
  }

}
