import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  SecurityAnalysis,
  SecurityFinding,
  SecuritySeverity,
} from '@app/analysis/models/security-analysis.model';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
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
  expandedFindings = new Set<string>();
  highlightedFilePath: string | null = null;
  codeEditorWidth = 420;

  readonly SEVERITY_ORDER: SecuritySeverity[] = ['critical', 'high', 'medium', 'low'];

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
  ) {}

  ngOnInit(): void {
    this.codeEditorWidth = this.layoutService.load('security-code')?.[0] ?? 420;

    const active = this.manager.getActive();
    this.security = active?.knowledgeModel?.ai?.security ?? null;
    this.hasWorkspace = active?.knowledgeModel != null;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.security = ws?.knowledgeModel?.ai?.security ?? null;
      this.hasWorkspace = ws?.knowledgeModel != null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onCodePanelResize(width: number): void {
    this.codeEditorWidth = width;
    this.layoutService.save('security-code', [width]);
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

  toggleFinding(id: string, fileName?: string): void {
    if (this.expandedFindings.has(id)) {
      this.expandedFindings.delete(id);
    } else {
      this.expandedFindings.add(id);
      if (fileName) this.highlightedFilePath = fileName;
    }
  }

  isFindingExpanded(id: string): boolean {
    return this.expandedFindings.has(id);
  }

  get folderTree(): FolderNode | undefined {
    return this.manager.getActive()?.knowledgeModel?.structure.folderTree;
  }

  onTreeFileSelected(file: FileNode): void {
    this.highlightedFilePath = file.path;
  }

  get criticalFindings(): SecurityFinding[] {
    return this.security?.findings.filter((f) => f.severity === 'critical') ?? [];
  }

  get highFindings(): SecurityFinding[] {
    return this.security?.findings.filter((f) => f.severity === 'high') ?? [];
  }

  get findingsBySeverity(): { severity: SecuritySeverity; findings: SecurityFinding[] }[] {
    if (!this.security?.findings.length) return [];
    return this.SEVERITY_ORDER.map((sev) => ({
      severity: sev,
      findings: this.security!.findings.filter((f) => f.severity === sev),
    })).filter((g) => g.findings.length > 0);
  }

  severityClass(s: SecuritySeverity): string {
    return (
      { critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' }[s] ??
      'sev-low'
    );
  }

  severityLabel(s: SecuritySeverity): string {
    return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[s] ?? s;
  }

  riskClass(s: SecuritySeverity): string {
    return (
      { critical: 'risk-critical', high: 'risk-high', medium: 'risk-medium', low: 'risk-low' }[s] ??
      'risk-low'
    );
  }

  maturityClass(m: string): string {
    return (
      { Low: 'maturity-low', Medium: 'maturity-medium', High: 'maturity-high' }[m] ??
      'maturity-medium'
    );
  }

  get llmSummary(): string | null {
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
}
