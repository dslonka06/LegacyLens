import { Injectable } from '@angular/core';
import { RepositoryExplanationContext } from '../../models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class RepositoryExplanationPromptBuilder {

  build(ctx: RepositoryExplanationContext): string {
    const parts: string[] = [];

    parts.push(
      `You are a senior software architect helping a developer understand a codebase they are joining.`,
      `Write a practical explanation that answers both "what does this system do?" and "how should I learn it?".`,
      `Base the explanation only on the structured knowledge provided below. Do not invent details.`,
      `Write in plain, direct prose. Use # section headings.`,
      ``,
    );

    parts.push(`## Repository: ${ctx.workspaceName}`);
    parts.push(`Type: ${ctx.workspaceType} | Files: ${ctx.totalFiles}`);
    parts.push(`Languages: ${ctx.languages.join(', ') || 'unknown'}`);
    parts.push(`Technologies: ${ctx.technologies.join(', ') || 'none detected'}`);

    if (ctx.projectNames.length > 0) {
      parts.push(`Projects: ${ctx.projectNames.join(', ')}`);
    }

    if (ctx.dependencyStats) {
      parts.push(`Dependency graph: ${ctx.dependencyStats.nodes} nodes, ${ctx.dependencyStats.edges} edges`);
    }

    if (ctx.executiveSummary) {
      parts.push(``, `## Existing Summary`, ctx.executiveSummary);
    }

    if (ctx.architecturePatterns.length > 0) {
      parts.push(``, `## Architecture Patterns`);
      for (const p of ctx.architecturePatterns) {
        const pct = Math.round(p.confidence * 100);
        parts.push(`- ${p.name} (${pct}% confidence)${p.indicators.length ? ': ' + p.indicators.slice(0, 3).join(', ') : ''}`);
      }
    }

    if (ctx.topWorkflows.length > 0) {
      parts.push(``, `## Key Application Workflows`);
      for (const wf of ctx.topWorkflows.slice(0, 5)) {
        parts.push(`- ${wf.title}: ${wf.description}`);
        if (wf.flowPath.length > 0) {
          parts.push(`  Flow: ${wf.flowPath.slice(0, 6).join(' → ')}`);
        }
      }
    }

    if (ctx.keyFiles.length > 0) {
      parts.push(``, `## Key Files`);
      for (const kf of ctx.keyFiles.slice(0, 8)) {
        parts.push(`- ${kf.name}: ${kf.reason}`);
      }
    }

    if (ctx.insights.length > 0) {
      parts.push(``, `## Repository Insights`);
      for (const ins of ctx.insights.slice(0, 6)) {
        parts.push(`- [${ins.severity.toUpperCase()}] ${ins.title}: ${ins.description}`);
      }
    }

    parts.push(
      ``,
      `## Your Task`,
      `Write a structured explanation with these sections:`,
      ``,
      `# Repository Overview`,
      `What this system does and the problem it solves. Who uses it.`,
      ``,
      `# Technologies & Architecture`,
      `The tech stack and how the code is organized. What patterns dominate.`,
      ``,
      `# Critical Workflows`,
      `The 2-3 most important workflows to understand first. Why each matters.`,
      ``,
      `# Recommended Learning Order`,
      `A concrete sequence: what to read first, what depends on what. Name specific components or files from the data.`,
      ``,
      `# Risks & Areas to Watch`,
      `What to be careful about when making changes. Known issues or fragile areas.`,
      ``,
      `Each section: 3-5 sentences. Total: 400-600 words. Be specific — name actual components and workflows from the data above.`,
    );

    return parts.join('\n');
  }
}
