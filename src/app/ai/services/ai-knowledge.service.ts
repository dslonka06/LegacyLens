import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import {
  RepositoryExplanationContext,
  WorkflowExplanationContext,
} from '@app/analysis/models/ai-explanation-context.model';
import { WorkspaceContext } from '@app/workspace/models/workspace-context.model';
import { RepositoryKnowledge } from '@app/knowledge/models/knowledge.model';
import { WorkflowSummary } from '@app/analysis/models/data-flow.model';
import { RepositoryInsight } from '@app/analysis/services/repository-insights.service';
import { RepositorySummaryService } from '@app/analysis/services/repository-summary.service';
import { DataFlowDiscoveryService } from '@app/analysis/services/data-flow-discovery.service';
import { WorkflowExplorerService } from '@app/analysis/services/workflow-explorer.service';
import { RepositoryInsightsService } from '@app/analysis/services/repository-insights.service';
import { RepositoryExplanationPromptBuilder } from '../prompts/repository-explanation-prompt';
import { WorkflowExplanationPromptBuilder } from '../prompts/workflow-explanation-prompt';
import { SecurityOverviewPromptBuilder } from '../prompts/security-overview-prompt';
import { SecurityAnalysis } from '@app/analysis/models/security-analysis.model';

interface ExplainRequest {
  prompt: string;
}

interface ExplainResponse {
  explanation: string;
}

@Injectable({ providedIn: 'root' })
export class AiKnowledgeService {

  private readonly apiUrl = 'http://localhost:5000/api/ai/explain';
  private readonly timeoutMs = 300_000; // 5 min — matches backend CTS

  constructor(
    private readonly http: HttpClient,
    private readonly summaryService: RepositorySummaryService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly repoPrompt: RepositoryExplanationPromptBuilder,
    private readonly workflowPrompt: WorkflowExplanationPromptBuilder,
    private readonly securityOverviewPrompt: SecurityOverviewPromptBuilder,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  explainRepository(
    ctx: WorkspaceContext,
    knowledge: RepositoryKnowledge,
  ): Observable<string> {
    const context = this.buildRepositoryContext(ctx, knowledge);
    const prompt = this.repoPrompt.build(context);
    return this.callApi(prompt);
  }

  generateSecurityOverview(
    ctx: WorkspaceContext,
    security: SecurityAnalysis,
    scope: 'file' | 'folder' | 'repository' = 'repository',
  ): Observable<string> {
    const prompt = this.securityOverviewPrompt.build({
      workspaceName:        ctx.workspaceName,
      languages:            ctx.profile.languages,
      technologies:         ctx.profile.technologies,
      architecturePatterns: [],
      security,
      scope,
    });
    return this.callApi(prompt);
  }

  explainWorkflow(
    ctx: WorkspaceContext,
    knowledge: RepositoryKnowledge,
    workflow: WorkflowSummary,
  ): Observable<string> {
    const context = this.buildWorkflowContext(ctx, knowledge, workflow);
    const prompt = this.workflowPrompt.build(context);
    return this.callApi(prompt);
  }

  // ── Context builders ──────────────────────────────────────────────────────
  // These aggregate LegacyLens knowledge — no raw source code is passed to AI.

  private buildRepositoryContext(
    ctx: WorkspaceContext,
    knowledge: RepositoryKnowledge,
  ): RepositoryExplanationContext {
    const summary = this.summaryService.build(ctx, knowledge, null);
    const insights: RepositoryInsight[] = this.insightsService.analyze(knowledge);
    const flows = this.dataFlowDiscovery.discoverWorkflows(
      knowledge,
      ctx.profile.repositoryStructure ?? undefined,
    );
    const workflows = this.workflowExplorer.buildSummaries(flows);

    return {
      workspaceName:        ctx.workspaceName,
      workspaceType:        ctx.profile.workspaceType,
      languages:            ctx.profile.languages,
      technologies:         ctx.profile.technologies,
      totalFiles:           ctx.profile.totalFiles,
      projectNames:         (ctx.profile.repositoryStructure?.projects ?? []).map(p => p.name),
      architecturePatterns: summary.architecturePatterns ?? [],
      topWorkflows:         workflows.slice(0, 5),
      insights:             insights.slice(0, 8).map(i => ({
        title:       i.title,
        description: i.description,
        severity:    i.severity,
        category:    i.category,
      })),
      keyFiles:         (summary.keyFiles ?? []).slice(0, 8).map(kf => ({ name: kf.name, reason: kf.reason })),
      executiveSummary: summary.executiveSummary,
      dependencyStats:  summary.dependencyStats
        ? { nodes: summary.dependencyStats.nodes, edges: summary.dependencyStats.edges }
        : undefined,
    };
  }

  private buildWorkflowContext(
    ctx: WorkspaceContext,
    knowledge: RepositoryKnowledge,
    workflow: WorkflowSummary,
  ): WorkflowExplanationContext {
    const graphNodes = knowledge.dependencyGraph?.nodes ?? [];
    const relatedNodeNames = workflow.flowPath
      .map(name => graphNodes.find(n => n.name === name || n.id === name)?.name ?? name)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    const architecturePatterns = (knowledge.architecture?.patterns ?? []).map(p => p.name);

    return {
      workspaceName:        ctx.workspaceName,
      workflow,
      relatedNodeNames,
      architecturePatterns,
    };
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────

  private callApi(prompt: string): Observable<string> {
    const body: ExplainRequest = { prompt };
    return this.http.post<ExplainResponse>(this.apiUrl, body).pipe(
      timeout(this.timeoutMs),
      map(res => res.explanation),
      catchError(err => throwError(() => err)),
    );
  }
}
