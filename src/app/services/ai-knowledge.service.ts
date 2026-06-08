import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import {
  RepositoryExplanationContext,
  WorkflowExplanationContext,
} from '../models/ai-explanation-context.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { RepositoryKnowledge } from '../models/knowledge.model';
import { WorkflowSummary } from '../models/data-flow.model';
import { RepositoryInsight } from './repository-insights.service';
import { RepositorySummaryService } from './repository-summary.service';
import { DataFlowDiscoveryService } from './data-flow-discovery.service';
import { WorkflowExplorerService } from './workflow-explorer.service';
import { RepositoryInsightsService } from './repository-insights.service';
import { RepositoryExplanationPromptBuilder } from './prompts/repository-explanation-prompt';
import { WorkflowExplanationPromptBuilder } from './prompts/workflow-explanation-prompt';

interface ExplainRequest {
  prompt: string;
}

interface ExplainResponse {
  explanation: string;
}

@Injectable({ providedIn: 'root' })
export class AiKnowledgeService {

  private readonly apiUrl = 'http://localhost:5000/api/ai/explain';
  private readonly timeoutMs = 90_000;

  constructor(
    private readonly http: HttpClient,
    private readonly summaryService: RepositorySummaryService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
    private readonly insightsService: RepositoryInsightsService,
    private readonly repoPrompt: RepositoryExplanationPromptBuilder,
    private readonly workflowPrompt: WorkflowExplanationPromptBuilder,
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
    const summary = this.summaryService.build(ctx, knowledge, null, null);
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
