import { Injectable } from '@angular/core';
import { AnalysisSession } from '../models/analysis-session.model';
import { RepositoryKnowledge } from '../models/knowledge.model';
import { WorkspaceProfile } from '../models/workspace.model';
import { WorkspaceContext } from '../models/workspace-context.model';
import { GuideRecommendation } from '../models/guide.model';
import {
  InsightSummaryItem,
  KeyFile,
  KeyProject,
  ModernizationItem,
  RepositorySummary,
  RiskSummaryItem,
} from '../models/repository-summary.model';
import { DependencyExplorerService } from './dependency-explorer.service';
import { RepositoryInsightsService } from './repository-insights.service';
import { DataFlowDiscoveryService } from './data-flow-discovery.service';
import { WorkflowExplorerService } from './workflow-explorer.service';

@Injectable({ providedIn: 'root' })
export class RepositorySummaryService {

  constructor(
    private readonly explorer: DependencyExplorerService,
    private readonly insights: RepositoryInsightsService,
    private readonly dataFlowDiscovery: DataFlowDiscoveryService,
    private readonly workflowExplorer: WorkflowExplorerService,
  ) {}

  // Primary entry: builds a RepositorySummary from all available intelligence.
  // Works for any workspace type — missing sources produce empty sections.
  build(
    workspaceContext: WorkspaceContext | null,
    knowledge: RepositoryKnowledge | null,
    session: AnalysisSession | null,
    guideRecommendation: GuideRecommendation | null,
  ): RepositorySummary {
    const profile = workspaceContext?.profile ?? session?.workspaceContext ?? null;
    const structure = profile?.repositoryStructure ?? null;

    const summary: RepositorySummary = {
      workspaceName: workspaceContext?.workspaceName ?? session?.fileName ?? 'Workspace',
      workspaceType: profile?.workspaceType ?? 'SingleFile',
      generatedAt: new Date().toISOString(),
      totalFiles: profile?.totalFiles ?? 1,
      languages: profile?.languages ?? this.languagesFromSession(session),
      technologies: this.technologiesFrom(profile),
    };

    // ── Executive Summary ─────────────────────────────────────────────────
    summary.executiveSummary = this.buildExecutiveSummary(workspaceContext, knowledge, session, profile);

    // ── Repository Overview ───────────────────────────────────────────────
    summary.repositoryOverview = this.buildRepositoryOverview(workspaceContext, profile, knowledge);

    // ── Architecture ──────────────────────────────────────────────────────
    if (knowledge?.architecture?.patterns?.length) {
      summary.architecturePatterns = knowledge.architecture.patterns.map(p => ({
        name: p.name,
        confidence: p.confidence,
        indicators: p.indicators,
      }));
      summary.architectureSummary = this.buildArchitectureSummary(knowledge, profile);
    } else if (session) {
      const ai = session.aiAnalysis;
      const ana = session.analysis;
      const patterns = ai?.architecture?.patterns ?? ana.patterns ?? [];
      if (patterns.length) {
        summary.architectureSummary = `Detected patterns: ${patterns.join(', ')}.`;
        summary.architecturePatterns = patterns.map(p => ({ name: p, confidence: 0, indicators: [] }));
      }
    }

    // ── Data Flow ─────────────────────────────────────────────────────────
    summary.dataFlowSummary = this.buildDataFlowSummary(session, knowledge);

    // ── Dependencies ──────────────────────────────────────────────────────
    if (knowledge?.dependencyGraph) {
      const graph = knowledge.dependencyGraph;
      summary.dependencyStats = {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        averageConnectivity: this.explorer.averageConnectivity(graph),
      };
      summary.dependencySummary = this.buildDependencySummary(knowledge);
    }

    // ── Risks ─────────────────────────────────────────────────────────────
    summary.risks = this.buildRisks(session, knowledge);

    // ── Modernizations ────────────────────────────────────────────────────
    summary.modernizations = this.buildModernizations(session);

    // ── Key Files ─────────────────────────────────────────────────────────
    summary.keyFiles = this.buildKeyFiles(session, knowledge, profile);

    // ── Key Projects ──────────────────────────────────────────────────────
    if (structure?.projects?.length) {
      summary.keyProjects = structure.projects.map(p => ({
        name: p.name,
        path: p.path,
        type: p.type,
        framework: p.framework,
        language: p.language,
      }));
    }

    // ── Repository Insights ───────────────────────────────────────────────
    if (knowledge) {
      const raw = this.insights.analyze(knowledge);
      summary.insights = raw
        .filter(i => i.severity !== 'info' || i.category !== 'stat')
        .map(i => ({
          title: i.title,
          description: i.description,
          severity: i.severity,
        }));
    }

    // ── Onboarding ────────────────────────────────────────────────────────
    summary.onboardingNotes = this.buildOnboardingNotes(workspaceContext, knowledge, session);
    summary.onboardingSteps = this.buildOnboardingSteps(guideRecommendation, profile);

    // ── Stage 7: Behavior & Data Flow Intelligence ────────────────────────
    if (knowledge) {
      const flows = this.dataFlowDiscovery.discoverWorkflows(knowledge, profile?.repositoryStructure ?? undefined);
      if (flows.length) {
        summary.workflowSummaries = this.workflowExplorer.buildSummaries(flows);
      }
      summary.behaviorInsights = this.dataFlowDiscovery.extractBehaviorInsights(knowledge);
    }

    return summary;
  }

  // ── Section builders ─────────────────────────────────────────────────────

  private buildExecutiveSummary(
    ctx: WorkspaceContext | null,
    knowledge: RepositoryKnowledge | null,
    session: AnalysisSession | null,
    profile: WorkspaceProfile | null,
  ): string {
    const parts: string[] = [];

    const name = ctx?.workspaceName ?? session?.fileName ?? 'this codebase';
    const type = profile?.workspaceType ?? 'SingleFile';
    const fileCount = profile?.totalFiles ?? 1;
    const langs = (profile?.languages ?? this.languagesFromSession(session)).join(', ') || 'unknown';

    parts.push(`${name} is a ${type.toLowerCase()} workspace containing ${fileCount} file${fileCount === 1 ? '' : 's'} written primarily in ${langs}.`);

    const techs = this.technologiesFrom(profile);
    if (techs.length) {
      parts.push(`Key technologies detected: ${techs.slice(0, 5).join(', ')}.`);
    }

    const projects = profile?.repositoryStructure?.projects ?? [];
    if (projects.length > 1) {
      parts.push(`The workspace contains ${projects.length} projects.`);
    }

    if (knowledge?.architecture?.patterns?.length) {
      const top = knowledge.architecture.patterns[0];
      parts.push(`Architecture analysis indicates ${top.name} (${Math.round(top.confidence * 100)}% confidence).`);
    }

    if (session?.aiAnalysis?.summary) {
      parts.push(session.aiAnalysis.summary);
    } else if (session?.analysis?.summary) {
      parts.push(session.analysis.summary);
    }

    return parts.join(' ');
  }

  private buildRepositoryOverview(
    ctx: WorkspaceContext | null,
    profile: WorkspaceProfile | null,
    knowledge: RepositoryKnowledge | null,
  ): string {
    const parts: string[] = [];
    const structure = profile?.repositoryStructure;

    if (structure) {
      parts.push(`Repository contains ${structure.totalFileCount} files across ${this.countFolders(structure.root)} folders.`);
      if (structure.maxDepth > 0) {
        parts.push(`Maximum folder depth: ${structure.maxDepth}.`);
      }
    }

    if (knowledge?.dependencyGraph) {
      const g = knowledge.dependencyGraph;
      parts.push(`Dependency graph: ${g.nodes.length} nodes, ${g.edges.length} relationships.`);
    }

    if (!parts.length) {
      return 'Workspace overview is not available for this upload type.';
    }
    return parts.join(' ');
  }

  private buildArchitectureSummary(
    knowledge: RepositoryKnowledge,
    profile: WorkspaceProfile | null,
  ): string {
    const patterns = knowledge.architecture?.patterns ?? [];
    if (!patterns.length) return '';
    const top = patterns.slice(0, 3);
    const list = top.map(p => `${p.name} (${Math.round(p.confidence * 100)}%)`).join(', ');
    return `Detected architectural patterns: ${list}. Key indicators: ${top.flatMap(p => p.indicators).slice(0, 6).join(', ')}.`;
  }

  private buildDataFlowSummary(
    session: AnalysisSession | null,
    knowledge: RepositoryKnowledge | null,
  ): string | undefined {
    const flow = session?.aiAnalysis?.architecture?.dataFlow
      ?? session?.analysis?.dataFlow;
    if (flow) return flow;
    if (knowledge?.dependencyGraph) {
      const g = knowledge.dependencyGraph;
      const avg = this.explorer.averageConnectivity(g);
      return `The system has ${g.edges.length} detected dependency relationships across ${g.nodes.length} files, with an average connectivity of ${avg} per file.`;
    }
    return undefined;
  }

  private buildDependencySummary(knowledge: RepositoryKnowledge): string {
    const graph = knowledge.dependencyGraph!;
    const top = this.explorer.rankByConnectivity(graph, 3);
    const hubs = this.explorer.dependencyHubs(graph);
    const orphans = this.explorer.orphanedFiles(graph);

    const parts: string[] = [];
    parts.push(`${graph.nodes.length} files mapped with ${graph.edges.length} dependency relationships.`);
    if (top.length) {
      parts.push(`Most connected: ${top.map(r => r.node.name).join(', ')}.`);
    }
    if (hubs.length) {
      parts.push(`${hubs.length} dependency hub${hubs.length > 1 ? 's' : ''} detected.`);
    }
    if (orphans.length) {
      parts.push(`${orphans.length} orphaned file${orphans.length > 1 ? 's' : ''} with no connections.`);
    }
    return parts.join(' ');
  }

  private buildRisks(session: AnalysisSession | null, knowledge: RepositoryKnowledge | null): RiskSummaryItem[] {
    const items: RiskSummaryItem[] = [];

    if (session?.aiAnalysis?.risks?.length) {
      session.aiAnalysis.risks.forEach(r => items.push({
        title: r.title,
        description: r.description,
        severity: r.severity.toLowerCase(),
      }));
    } else if (session?.analysis?.risks?.length) {
      session.analysis.risks.forEach(r => items.push({
        title: r.description,
        description: r.description,
        severity: r.severity.toLowerCase(),
      }));
    }

    // Supplement with knowledge-based risks (god classes, bottlenecks)
    if (knowledge) {
      const insightRisks = this.insights.analyze(knowledge)
        .filter(i => i.severity === 'high' || i.severity === 'medium')
        .filter(i => i.category !== 'stat')
        .slice(0, 5);
      insightRisks.forEach(i => items.push({
        title: i.title,
        description: i.description,
        severity: i.severity,
      }));
    }

    return items;
  }

  private buildModernizations(session: AnalysisSession | null): ModernizationItem[] {
    if (session?.aiAnalysis?.modernizations?.length) {
      return session.aiAnalysis.modernizations.map(m => ({ title: m.title, description: m.description }));
    }
    if (session?.analysis?.modernizationSuggestions?.length) {
      return session.analysis.modernizationSuggestions.map(m => ({
        title: m.description,
        description: m.description,
      }));
    }
    return [];
  }

  private buildKeyFiles(
    session: AnalysisSession | null,
    knowledge: RepositoryKnowledge | null,
    profile: WorkspaceProfile | null,
  ): KeyFile[] {
    const keys: KeyFile[] = [];
    const seen = new Set<string>();

    // Single-file session
    if (session && !knowledge) {
      keys.push({ name: session.fileName, path: session.fileName, reason: 'Primary analyzed file' });
      return keys;
    }

    // Most connected files from dependency graph
    if (knowledge?.dependencyGraph) {
      const top = this.explorer.rankByConnectivity(knowledge.dependencyGraph, 10);
      for (const r of top) {
        if (seen.has(r.node.name)) continue;
        seen.add(r.node.name);
        keys.push({
          name: r.node.name,
          path: r.node.path,
          reason: `${r.total} dependency connections (${r.inbound} incoming, ${r.outbound} outgoing)`,
          connectionCount: r.total,
        });
      }
    }

    // Project files from structure
    const projects = profile?.repositoryStructure?.projects ?? [];
    for (const p of projects.slice(0, 5)) {
      if (seen.has(p.projectFile)) continue;
      seen.add(p.projectFile);
      keys.push({
        name: p.name,
        path: p.projectFile,
        reason: `${p.type} project file`,
      });
    }

    return keys.slice(0, 15);
  }

  private buildOnboardingNotes(
    ctx: WorkspaceContext | null,
    knowledge: RepositoryKnowledge | null,
    session: AnalysisSession | null,
  ): string {
    const parts: string[] = [];
    const name = ctx?.workspaceName ?? session?.fileName ?? 'this system';

    parts.push(`To get started with ${name}:`);

    if (knowledge?.architecture?.patterns?.length) {
      const top = knowledge.architecture.patterns[0];
      parts.push(`The system follows ${top.name}. Understanding this pattern will help navigate the codebase.`);
    }

    const projects = ctx?.profile?.repositoryStructure?.projects ?? [];
    if (projects.length) {
      parts.push(`The workspace contains ${projects.length} project${projects.length > 1 ? 's' : ''}: ${projects.map(p => p.name).slice(0, 3).join(', ')}.`);
    }

    return parts.join(' ');
  }

  private buildOnboardingSteps(
    guide: GuideRecommendation | null,
    profile: WorkspaceProfile | null,
  ): string[] {
    if (guide?.steps?.length) return guide.steps;

    // Default onboarding steps based on workspace type
    const type = profile?.workspaceType ?? 'SingleFile';
    if (type === 'Repository' || type === 'Project') {
      return [
        'Review the Repository Overview to understand the system at a high level.',
        'Explore the Architecture to understand structural patterns.',
        'Review the Dependency Analysis to identify key files.',
        'Read through Key Projects and their responsibilities.',
        'Review Risks before making any modifications.',
      ];
    }
    return [
      'Read the Executive Summary to understand what this code does.',
      'Review the Architecture section for structural context.',
      'Check the Risks section before modifying anything.',
    ];
  }

  // ── Utilities ────────────────────────────────────────────

  private technologiesFrom(profile: WorkspaceProfile | null): string[] {
    if (!profile) return [];
    const fromDetected = profile.detectedTechnologies?.map(t => t.technology) ?? [];
    return fromDetected.length ? fromDetected : profile.technologies;
  }

  private languagesFromSession(session: AnalysisSession | null): string[] {
    if (!session) return [];
    const lang = session.analysis?.language;
    return lang ? [lang] : [];
  }

  private countFolders(folder: { children: any[] }): number {
    return folder.children.reduce((n: number, c: any) => n + 1 + this.countFolders(c), 0);
  }
}
