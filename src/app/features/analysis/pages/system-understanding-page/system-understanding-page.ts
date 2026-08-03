import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-system-understanding-page',
  standalone: true,
  imports: [CommonModule, ExplanationCard, ThemeToggle],
  templateUrl: './system-understanding-page.html',
  styleUrl: './system-understanding-page.scss',
})
export class SystemUnderstandingPage implements OnInit, OnDestroy {
  understanding: SystemUnderstanding | null = null;
  hasWorkspace = false;
  showHealthInfo = false;
  showPurposeInfo = false;
  showRespInfo = false;
  showCompInfo = false;
  showDebtInfo = false;
  showCompClasses = false;
  showCompMethods = false;
  showCompImportsExports = false;
  expandedResponsibilityIndex: number | null = null;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const active = this.manager.getActive();
    this.hasWorkspace = active !== null;
    this.understanding = active?.knowledgeModel?.ai?.understanding ?? null;
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.hasWorkspace = ws !== null;
      this.understanding = ws?.knowledgeModel?.ai?.understanding ?? null;
      this.showCompClasses = false;
      this.showCompMethods = false;
      this.showCompImportsExports = false;
      this.expandedResponsibilityIndex = null;
      this.expandedComponentGroupIndex = null;
      this.cdr.detectChanges();
    });
  }

  // ── Knowledge model access ────────────────────────────────────────────────

  private get knowledgeModel() {
    return this.manager.getActive()?.knowledgeModel ?? null;
  }

  // ── Code Health ───────────────────────────────────────────────────────────

  get complexity(): string {
    return this.knowledgeModel?.insights.complexity ?? '—';
  }

  get maintainability(): string {
    return this.knowledgeModel?.insights.maintainability ?? '—';
  }


  get healthTier(): 'healthy' | 'fair' | 'needs-attention' | 'critical' | 'unknown' {
    const c = this.knowledgeModel?.insights.complexity;
    const m = this.knowledgeModel?.insights.maintainability;
    if (!c || !m) return 'unknown';
    if (c === 'High' || m === 'Low') return 'critical';
    if (c === 'Low' && m === 'High') return 'healthy';
    if (c === 'Medium' || m === 'Medium') return 'fair';
    return 'needs-attention';
  }

  get healthTierLabel(): string {
    const map: Record<string, string> = {
      healthy: 'Healthy',
      fair: 'Fair',
      'needs-attention': 'Needs Attention',
      critical: 'Critical',
      unknown: 'Pending',
    };
    return map[this.healthTier];
  }

  // ── Responsibility accordion ──────────────────────────────────────────────

  toggleResponsibility(index: number): void {
    this.expandedResponsibilityIndex = this.expandedResponsibilityIndex === index ? null : index;
  }

  isResponsibilityExpanded(index: number): boolean {
    return this.expandedResponsibilityIndex === index;
  }

  // ── Heuristic narratives ──────────────────────────────────────────────────

  get businessPurposeNarrative(): string {
    return this.knowledgeModel?.ai?.businessPurposeNarrative ?? '';
  }

  get codeHealthNarrative(): string {
    return this.knowledgeModel?.ai?.codeHealthNarrative ?? '';
  }

  get fileResponsibilities(): Array<{ text: string; description: string }> {
    const responsibilities = this.understanding?.keyResponsibilities ?? [];
    const descriptions = this.knowledgeModel?.ai?.fileResponsibilitiesNarrative ?? [];
    return responsibilities.map((text, i) => ({
      text,
      description: descriptions[i] ?? '',
    }));
  }

  get folderResponsibilities(): Array<{ text: string; description: string }> {
    const responsibilities = this.understanding?.keyResponsibilities ?? [];
    const descriptions = this.knowledgeModel?.ai?.folderResponsibilitiesNarrative ?? [];
    return responsibilities.map((text, i) => ({
      text,
      description: descriptions[i] ?? '',
    }));
  }

  get folderComponents(): Array<{ responsibility: string; components: Array<{ name: string; whyImportant: string; blastRadius: 'High' | 'Medium' | 'Low' }> }> {
    return (this.understanding?.responsibilityGroups ?? []).map(g => ({
      responsibility: g.responsibility,
      components: g.components.map(c => ({
        name: c.name,
        whyImportant: c.whyImportant,
        blastRadius: c.blastRadius,
      })),
    }));
  }

  expandedComponentGroupIndex: number | null = null;

  toggleComponentGroup(index: number): void {
    this.expandedComponentGroupIndex = this.expandedComponentGroupIndex === index ? null : index;
  }

  isComponentGroupExpanded(index: number): boolean {
    return this.expandedComponentGroupIndex === index;
  }

  get debtHotspots(): Array<{ name: string; reason: string; narrative: string }> {
    const hotspots = this.understanding?.technicalDebtHotspots ?? [];
    const narratives = this.knowledgeModel?.ai?.debtHotspotsNarrative ?? [];
    return hotspots.map((h, i) => ({
      name: h.name,
      reason: h.reason,
      narrative: narratives[i] ?? h.impact,
    }));
  }

  get fileComponentClasses(): string[] {
    return (this.knowledgeModel?.ai?.fileComponentsNarrative?.items ?? [])
      .filter(i => i.kind === 'class')
      .map(i => i.name);
  }

  get fileComponentMethods(): string[] {
    return (this.knowledgeModel?.ai?.fileComponentsNarrative?.items ?? [])
      .filter(i => i.kind === 'method')
      .map(i => i.name);
  }

  get fileComponentImports(): string[] {
    return this.knowledgeModel?.ai?.fileComponentsNarrative?.imports ?? [];
  }

  get fileComponentExports(): string[] {
    return this.knowledgeModel?.ai?.fileComponentsNarrative?.exports ?? [];
  }

  // ── LLM summary ───────────────────────────────────────────────────────────

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.manager.getActive()?.knowledgeModel?.ai?.summaries?.understanding ?? null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get showExplanationCard(): boolean {
    return this.hasWorkspace && this.understanding !== null;
  }
}
