import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  SecurityAnalysis,
  SecurityFinding,
  SecuritySeverity,
} from '@app/analysis/models/security-analysis.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { LLMSummaryService } from '@app/analysis/services/llm-summary.service';
import type { LLMSummaryEntry } from '@app/knowledge/models/llm-summaries.model';
import { FileTreePanel } from '@app/shared/components/file-tree-panel/file-tree-panel';
import { CodeEditor } from '@app/shared/components/code-editor/code-editor';
import { ResizeDividerComponent } from '@app/shell/resize-divider/resize-divider.component';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';
import { PanelLayoutService } from '@app/core/services/panel-layout.service';
import type { FolderNode, FileNode } from '@app/knowledge/models/repository.model';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, FileTreePanel, CodeEditor, ResizeDividerComponent, ThemeToggle, ExplanationCard],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage implements OnInit, OnDestroy {
  security: SecurityAnalysis | null = null;
  hasWorkspace = false;
  activeTab: SecuritySeverity = 'critical';
  expandedFindingId: string | null = null;
  highlightLines: { start: number; end: number } | null = null;
  highlightedFilePath: string | null = null;
  codeEditorWidth = 420;
  codeCollapsed = false;
  private _preCollapseWidth = 420;

  readonly SEVERITY_ORDER: SecuritySeverity[] = ['critical', 'high', 'medium', 'low'];

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
    private readonly llmSummaryService: LLMSummaryService,
  ) {}

  ngOnInit(): void {
    this.codeEditorWidth = this.layoutService.load('security-code')?.[0] ?? 420;

    const active = this.manager.getActive();
    this.security = active?.knowledgeModel?.ai?.security ?? null;
    this.hasWorkspace = active?.knowledgeModel != null;
    this._resetToHighestTab();

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.security = ws?.knowledgeModel?.ai?.security ?? null;
      this.hasWorkspace = ws?.knowledgeModel != null;
      this.expandedFindingId = null;
      this.highlightLines = null;
      this.highlightedFilePath = null;
      this._resetToHighestTab();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private _resetToHighestTab(): void {
    if (!this.security?.findings.length) { this.activeTab = 'critical'; return; }
    const first = this.SEVERITY_ORDER.find(s => this.security!.findings.some(f => f.severity === s));
    this.activeTab = first ?? 'critical';
  }

  onCodePanelResize(width: number): void {
    this.codeEditorWidth = width;
    this.layoutService.save('security-code', [width]);
  }

  toggleCodePanel(): void {
    if (this.codeCollapsed) {
      this.codeEditorWidth = this._preCollapseWidth;
      this.codeCollapsed = false;
    } else {
      this._preCollapseWidth = this.codeEditorWidth;
      this.codeCollapsed = true;
    }
  }

  selectTab(sev: SecuritySeverity): void {
    this.activeTab = sev;
    this.expandedFindingId = null;
    this.highlightLines = null;
  }

  toggleFinding(finding: SecurityFinding): void {
    if (this.expandedFindingId === finding.id) {
      this.expandedFindingId = null;
      this.highlightLines = null;
    } else {
      this.expandedFindingId = finding.id;
      if (finding.fileName) this.highlightedFilePath = finding.fileName;
      if (this.isFileScope && finding.lineStart) {
        this.highlightLines = {
          start: finding.lineStart,
          end: finding.lineEnd ?? finding.lineStart,
        };
      } else {
        this.highlightLines = null;
      }
    }
  }

  isFindingExpanded(id: string): boolean {
    return this.expandedFindingId === id;
  }

  get findingsForTab(): SecurityFinding[] {
    return this.security?.findings.filter(f => f.severity === this.activeTab) ?? [];
  }

  tabCount(sev: SecuritySeverity): number {
    return this.security?.findings.filter(f => f.severity === sev).length ?? 0;
  }

  get hasFindings(): boolean {
    return (this.security?.findings.length ?? 0) > 0;
  }

  get hasNextSteps(): boolean {
    return (this.security?.nextSteps?.length ?? 0) > 0;
  }

  get isFileScope(): boolean {
    return this.manager.getActive()?.knowledgeModel?.targetType === 'file';
  }

  get hotspots() {
    return this.security?.hotspots ?? [];
  }

  get sourceCode(): string | undefined {
    return this.manager.getActive()?.knowledgeModel?.structure.sourceCode;
  }

  get sourceFileName(): string | undefined {
    return (
      this.manager.getActive()?.knowledgeModel?.structure.filePath ??
      this.manager.getActive()?.knowledgeModel?.workspaceName ??
      undefined
    );
  }

  get folderTree(): FolderNode | undefined {
    return this.manager.getActive()?.knowledgeModel?.structure.folderTree;
  }

  onTreeFileSelected(file: FileNode): void {
    this.highlightedFilePath = file.path;
  }

severityClass(s: SecuritySeverity): string {
    return { critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' }[s] ?? 'sev-low';
  }

  severityLabel(s: SecuritySeverity): string {
    return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[s] ?? s;
  }

  categoryLabel(c: string): string {
    return {
      'secrets-management': 'Secrets',
      'authentication': 'Auth',
      'authorization': 'Authorization',
      'input-validation': 'Input Validation',
      'sql-injection': 'SQL Injection',
      'file-access': 'File Access',
      'external-calls': 'External Calls',
      'configuration': 'Configuration',
      'broad-access': 'Broad Access',
      'ai-finding': 'AI Finding',
    }[c] ?? c;
  }

  riskClass(s: SecuritySeverity): string {
    return { critical: 'risk-critical', high: 'risk-high', medium: 'risk-medium', low: 'risk-low' }[s] ?? 'risk-low';
  }

  maturityClass(m: string): string {
    return { Low: 'maturity-low', Medium: 'maturity-medium', High: 'maturity-high' }[m] ?? 'maturity-medium';
  }

  hotspotRiskClass(level: SecuritySeverity): string {
    return this.riskClass(level);
  }

  get llmSummaryEntry(): LLMSummaryEntry | null {
    return this.manager.getActive()?.knowledgeModel?.ai?.summaries?.security ?? null;
  }

  get isGenerating(): boolean {
    const wsId = this.manager.getActive()?.id ?? '';
    return this.manager.getActiveStages(wsId).has('generate');
  }

  get isNoProvider(): boolean {
    const ai = this.manager.getActive()?.knowledgeModel?.ai;
    return ai?.failedStages.includes('generate') === true && ai?.stageErrors?.['generate'] === 'no-provider';
  }

  onRegenerate(): void {
    const wsId = this.manager.getActive()?.id;
    if (wsId) this.llmSummaryService.regenerate(wsId, 'security');
  }
}
