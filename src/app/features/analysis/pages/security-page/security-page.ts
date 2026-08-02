import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, ThemeToggle, ExplanationCard],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage implements OnInit, OnDestroy {
  security: SecurityAnalysis | null = null;
  hasWorkspace = false;
  expandedFindingId: string | null = null;
  expandedCheckDomain: SecurityVerificationDomain | null = null;

  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly llmSummary: LLMSummaryService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const active = this.manager.getActive();
    this.security = active?.knowledgeModel?.ai?.security ?? null;
    this.hasWorkspace = active?.knowledgeModel != null;

    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      this.security = ws?.knowledgeModel?.ai?.security ?? null;
      this.hasWorkspace = ws?.knowledgeModel != null;
      this.expandedFindingId = null;
      this.expandedCheckDomain = null;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleFinding(finding: SecurityFinding): void {
    this.expandedFindingId = this.expandedFindingId === finding.id ? null : finding.id;
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

  onRegenerate(): void {
    const wsId = this.manager.getActive()?.id;
    if (wsId) this.llmSummary.regenerate(wsId, 'security');
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
