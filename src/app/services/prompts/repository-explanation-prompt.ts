import { Injectable } from '@angular/core';
import { RepositoryExplanationContext } from '../../models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class RepositoryExplanationPromptBuilder {

  build(ctx: RepositoryExplanationContext): string {
    const parts: string[] = [];

    parts.push(
      `You are a senior software architect explaining a codebase to a developer joining the team.`,
      `Explain the repository clearly and concisely based only on the structured knowledge provided below.`,
      `Do not invent details. Do not ask for more information.`,
      `Write in plain, direct prose. No bullet lists unless the section naturally calls for them.`,
      ``,
    );

    parts.push(`## Repository: ${ctx.workspaceName}`);
    parts.push(`Type: ${ctx.workspaceType}`);
    parts.push(`Files: ${ctx.totalFiles}`);
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
      for (const wf of ctx.topWorkflows.slice(0, 4)) {
        parts.push(`- ${wf.title}: ${wf.description}`);
        if (wf.flowPath.length > 0) {
          parts.push(`  Flow: ${wf.flowPath.slice(0, 6).join(' → ')}`);
        }
      }
    }

    if (ctx.insights.length > 0) {
      parts.push(``, `## Repository Insights`);
      for (const ins of ctx.insights.slice(0, 6)) {
        parts.push(`- [${ins.severity.toUpperCase()}] ${ins.title}: ${ins.description}`);
      }
    }

    if (ctx.keyFiles.length > 0) {
      parts.push(``, `## Key Files`);
      for (const kf of ctx.keyFiles.slice(0, 6)) {
        parts.push(`- ${kf.name}: ${kf.reason}`);
      }
    }

    parts.push(
      ``,
      `## Your Task`,
      `Write a structured explanation covering:`,
      `1. What this system does and its purpose`,
      `2. The main technologies and why they matter`,
      `3. How the architecture is organized`,
      `4. The most important workflows`,
      `5. Notable risks or areas that need attention`,
      `6. The most important areas for a new developer to focus on`,
      ``,
      `Keep each section to 2-4 sentences. Total response should be 300-500 words.`,
    );

    return parts.join('\n');
  }
}
