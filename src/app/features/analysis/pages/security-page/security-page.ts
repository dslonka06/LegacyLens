import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  SecurityAnalysis,
  SecurityFinding,
  SecuritySeverity,
  SecurityVerificationCheck,
  SecurityVerificationDomain,
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
  expandedFindingId: string | null = null;
  expandedCheckDomain: SecurityVerificationDomain | null = null;
  highlightLines: { start: number; end: number } | null = null;
  highlightedFilePath: string | null = null;
  codeEditorWidth = 420;
  codeCollapsed = false;
  private _preCollapseWidth = 420;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly layoutService: PanelLayoutService,
    private readonly llmSummary: LLMSummaryService,
  ) {}

  ngOnInit(): void {
    this.codeEditorWidth = this.layoutService.load('security-code')?.[0] ?? 420;

    const active = this.manager.getActive();
    this.security = active?.knowledgeModel?.ai?.security ?? null;
    this.hasWorkspace = active?.knowledgeModel != null;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.security = ws?.knowledgeModel?.ai?.security ?? null;
      this.hasWorkspace = ws?.knowledgeModel != null;
      this.expandedFindingId = null;
      this.expandedCheckDomain = null;
      this.highlightLines = null;
      this.highlightedFilePath = null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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

  toggleFinding(finding: SecurityFinding): void {
    if (this.expandedFindingId === finding.id) {
      this.expandedFindingId = null;
      this.highlightLines = null;
    } else {
      this.expandedFindingId = finding.id;
      if (finding.filePath || finding.fileName) {
        this.highlightedFilePath = finding.filePath ?? finding.fileName;
      }
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

  toggleCheck(check: SecurityVerificationCheck): void {
    if (!check.detail) return;
    this.expandedCheckDomain = this.expandedCheckDomain === check.domain ? null : check.domain;
  }

  isFindingExpanded(id: string): boolean {
    return this.expandedFindingId === id;
  }

  isCheckExpanded(domain: SecurityVerificationDomain): boolean {
    return this.expandedCheckDomain === domain;
  }

  get findings(): SecurityFinding[] {
    return this.security?.findings ?? [];
  }

  get verificationChecks(): SecurityVerificationCheck[] {
    return this.security?.verificationChecks ?? [];
  }

  get hasFindings(): boolean {
    return this.findings.length > 0;
  }

  get hasVerificationChecks(): boolean {
    return this.verificationChecks.length > 0;
  }

  get isLlmComplete(): boolean {
    const status = this.llmSummaryEntry?.status;
    return status === 'complete' || status === 'failed';
  }

  get isLlmFailed(): boolean {
    return this.llmSummaryEntry?.status === 'failed' && !this.isNoProvider;
  }

  get isSecurityGenerating(): boolean {
    const status = this.llmSummaryEntry?.status;
    if (status === 'complete' || status === 'failed') return false;
    const wsId = this.manager.getActive()?.id ?? '';
    return this.manager.getActiveStages(wsId).has('generate');
  }

  get isFileScope(): boolean {
    return this.manager.getActive()?.knowledgeModel?.targetType === 'file';
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

  onRegenerate(): void {
    const wsId = this.manager.getActive()?.id;
    if (wsId) this.llmSummary.regenerate(wsId, 'security');
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
    return ({
      'secrets-management': 'Secrets',
      'authentication':     'Auth',
      'authorization':      'Authorization',
      'input-validation':   'Input Validation',
      'sql-injection':      'SQL Injection',
      'file-access':        'File Access',
      'external-calls':     'External Calls',
      'configuration':      'Configuration',
      'broad-access':       'Broad Access',
      'cryptography':       'Cryptography',
      'ai-finding':         'AI Finding',
    } as Record<string, string>)[c] ?? c;
  }

  domainLabel(d: SecurityVerificationDomain): string {
    return ({
      'secrets':          'Secrets Management',
      'input-validation': 'Input Validation',
      'authentication':   'Authentication',
      'authorization':    'Authorization',
      'data-access':      'Data Access',
      'logging':          'Logging',
      'error-handling':   'Error Handling',
      'cryptography':     'Cryptography',
    } as Record<string, string>)[d] ?? d;
  }

  checkStatusIcon(status: 'pass' | 'warn' | 'fail'): string {
    return { pass: '✓', warn: '⚠', fail: '✗' }[status] ?? '?';
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

  get hasEvidence(): boolean {
    return this.security?.evidence != null;
  }

}
