import { Injectable } from '@angular/core';
import type { RepositoryExplanationContext } from '@app/analysis/models/ai-explanation-context.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

export interface UnderstandingSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  understanding: SystemUnderstanding;
  architecture: ArchitectureAIAnalysis | null;
  repositoryContext: RepositoryExplanationContext | null;
  totalFiles: number;
  languages: string[];
  technologies: string[];
}

@Injectable({ providedIn: 'root' })
export class RepositoryExplanationPromptBuilder {
  build(ctx: UnderstandingSummaryContext | RepositoryExplanationContext): string {
    // Detect which context shape was passed and normalize
    if ('understanding' in ctx) {
      return this._buildFromUnderstanding(ctx as UnderstandingSummaryContext);
    }
    return this._buildFromRepositoryContext(ctx as RepositoryExplanationContext);
  }

  private _buildFromUnderstanding(ctx: UnderstandingSummaryContext): string {
    const parts: string[] = [];
    const { understanding: u, architecture, scope } = ctx;

    const hasDebt        = u.technicalDebtHotspots && u.technicalDebtHotspots.length > 0;
    const hasWorkflows   = u.mostImportantWorkflows && u.mostImportantWorkflows.length > 0;
    const hasDeps        = u.mostImportantDependencies && u.mostImportantDependencies.length > 0;
    const highRisk       = u.highRiskAreas.length > 0;

    // ── Persona ─────────────────────────────────────────────────────────────
    parts.push(
      `You are a senior software engineer who has just completed a deep structural analysis of a codebase.`,
      `You are writing an introductory brief for a developer who is about to work in this system.`,
      ``,
      `Your goal is to give that developer genuine insight — not a description of what was found,`,
      `but an interpretation of what it means. The structural data is already shown on the page.`,
      `Answer: what kind of system is this, how was it designed to work, and what does a developer`,
      `absolutely need to understand before making changes?`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      `Do not restate metrics. Reason about their implications.`,
      ``,
    );

    // ── Output format ────────────────────────────────────────────────────────
    if (scope === 'file') {
      parts.push(
        `Output: 2–3 sentences. What is this file's role in the system and what must a developer`,
        `understand about it before modifying it?`,
      );
    } else if (scope === 'folder') {
      parts.push(
        `Output: 2 short paragraphs, 80–130 words.`,
        `Paragraph 1: What is the purpose and responsibility boundary of this folder area?`,
        `Paragraph 2: What are the most important things to know before changing code here?`,
      );
    } else {
      parts.push(
        `Output: 3 paragraphs, 160–240 words.`,
        `Paragraph 1: What kind of system is this — what does it do, who depends on it, and what`,
        `architectural decisions shaped its current form? Reference the detected patterns and capabilities.`,
        `Paragraph 2: What is the most important structural fact about this system that is not obvious`,
        `from the file tree? Consider the coupling level, the key workflows, and the critical areas.`,
        `Paragraph 3: What should a developer working in this system understand first — and what is the`,
        `most common mistake someone would make without that understanding?`,
      );
    }

    parts.push(``);

    // ── Evidence block ───────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);
    parts.push(`Size: ${ctx.totalFiles} files | Languages: ${ctx.languages.join(', ')}`);
    if (ctx.technologies.length > 0) {
      parts.push(`Technologies: ${ctx.technologies.join(', ')}`);
    }
    parts.push(``);

    parts.push(`Business criticality: ${u.businessCriticality} — ${u.businessCriticalityReason}`);
    parts.push(`Health: complexity ${u.health.complexity}, maintainability ${u.health.maintainability}, risk ${u.health.riskLevel}`);

    if (u.coreCapabilities.length > 0) {
      parts.push(`Core capabilities: ${u.coreCapabilities.slice(0, 4).map(c => `${c.name} (${c.description})`).join(' | ')}`);
    }

    if (u.keyWorkflows.length > 0) {
      parts.push(`Key workflows: ${u.keyWorkflows.slice(0, 4).join(', ')}`);
    }

    if (u.criticalAreas.length > 0) {
      parts.push(`Critical areas: ${u.criticalAreas.slice(0, 4).join(', ')}`);
    }

    if (highRisk) {
      parts.push(`High-risk areas: ${u.highRiskAreas.slice(0, 3).join(', ')}`);
    }

    if (hasWorkflows && u.mostImportantWorkflows) {
      parts.push(``, `Most important workflows:`);
      for (const wf of u.mostImportantWorkflows.slice(0, 3)) {
        parts.push(`- ${wf.name}: ${wf.description}`);
      }
    }

    if (hasDeps && u.mostImportantDependencies) {
      parts.push(``, `Key dependencies:`);
      for (const dep of u.mostImportantDependencies.slice(0, 4)) {
        parts.push(`- ${dep.name} (${dep.type}): ${dep.whyImportant}`);
      }
    }

    if (hasDebt && u.technicalDebtHotspots) {
      parts.push(``, `Technical debt hotspots:`);
      for (const hot of u.technicalDebtHotspots.slice(0, 3)) {
        parts.push(`- ${hot.name}: ${hot.reason} — impact: ${hot.impact}`);
      }
    }

    if (architecture) {
      parts.push(``, `Architecture:`);
      parts.push(`Pattern: ${architecture.dominantPattern} (${Math.round(architecture.patternConfidence * 100)}% confidence)`);
      parts.push(`Coupling: ${architecture.couplingAssessment} | Hub nodes: ${architecture.hubCount} | Circular deps: ${architecture.circularDependencyCount}`);
      if (architecture.boundaryViolations.length > 0) {
        parts.push(`Boundary violations: ${architecture.boundaryViolations.slice(0, 3).join(', ')}`);
      }
    }

    if (u.mostImportantItems.length > 0) {
      parts.push(``, `Most important files/components:`);
      for (const item of u.mostImportantItems.slice(0, 5)) {
        parts.push(`- ${item.name}: ${item.whyImportant}`);
      }
    }

    parts.push(
      ``,
      `Reason about what this system is and what matters most. Do not describe the data — interpret it.`,
    );

    return parts.join('\n');
  }

  // Legacy path — called when no SystemUnderstanding is available yet
  private _buildFromRepositoryContext(ctx: RepositoryExplanationContext): string {
    const parts: string[] = [];
    parts.push(
      `You are a senior engineer explaining a codebase to a developer joining the team.`,
      `Interpret what the structural data means — do not describe it.`,
      `Write 2–4 plain prose sentences. No headers, no bullets.`,
      ``,
      `System: ${ctx.workspaceName} (${ctx.workspaceType}) | Files: ${ctx.totalFiles}`,
    );
    if (ctx.languages.length)           parts.push(`Languages: ${ctx.languages.join(', ')}`);
    if (ctx.architecturePatterns.length) parts.push(`Architecture: ${ctx.architecturePatterns.map(p => p.name).join(', ')}`);
    if (ctx.executiveSummary)           parts.push(`Summary: ${ctx.executiveSummary}`);
    if (ctx.dependencyStats)            parts.push(`Dependency graph: ${ctx.dependencyStats.nodes} nodes, ${ctx.dependencyStats.edges} edges`);
    parts.push(``, `What does this system do and what must a new developer understand first?`);
    return parts.join('\n');
  }
}
