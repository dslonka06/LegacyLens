import { Injectable } from '@angular/core';
import { RepositoryExplanationContext } from '@app/analysis/models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class RepositoryExplanationPromptBuilder {
  build(ctx: RepositoryExplanationContext): string {
    const parts: string[] = [];

    // ── Persona and constraints ───────────────────────────────────────────────
    parts.push(
      `You are a senior engineer explaining a codebase to a developer who is joining the team.`,
      `Your goal is interpretation, not description. The developer can already see the file list,`,
      `technology stack, architecture patterns, and dependency graph on the page.`,
      `Do not repeat those facts. Instead explain what they mean — why the system is built this way,`,
      `what the implications are, and what a developer needs to understand to work in it safely.`,
      `Write in plain prose. Use ## section headings. No bullet lists unless a list genuinely helps.`,
      `Do not invent details not present in the data below.`,
      ``,
    );

    // ── Structured knowledge — context only, not to be repeated ──────────────
    parts.push(`Repository: ${ctx.workspaceName}`);
    parts.push(`Type: ${ctx.workspaceType} | Files: ${ctx.totalFiles}`);

    if (ctx.projectNames.length > 0) {
      parts.push(`Projects: ${ctx.projectNames.join(', ')}`);
    }

    if (ctx.executiveSummary) {
      parts.push(`Summary: ${ctx.executiveSummary}`);
    }

    if (ctx.architecturePatterns.length > 0) {
      const patternNames = ctx.architecturePatterns
        .map((p) => `${p.name} (${Math.round(p.confidence * 100)}%)`)
        .join(', ');
      parts.push(`Architecture: ${patternNames}`);
    }

    if (ctx.topWorkflows.length > 0) {
      parts.push(``, `Key workflows:`);
      for (const wf of ctx.topWorkflows.slice(0, 5)) {
        parts.push(`- ${wf.title}: ${wf.description}`);
      }
    }

    if (ctx.keyFiles.length > 0) {
      parts.push(``, `Key files:`);
      for (const kf of ctx.keyFiles.slice(0, 6)) {
        parts.push(`- ${kf.name}: ${kf.reason}`);
      }
    }

    if (ctx.insights.length > 0) {
      parts.push(``, `Known issues and risks:`);
      for (const ins of ctx.insights.slice(0, 5)) {
        parts.push(`- [${ins.severity}] ${ins.title}: ${ins.description}`);
      }
    }

    if (ctx.dependencyStats) {
      parts.push(
        `Dependency graph: ${ctx.dependencyStats.nodes} components, ${ctx.dependencyStats.edges} connections`,
      );
    }

    // ── Task ─────────────────────────────────────────────────────────────────
    parts.push(
      ``,
      `Write a plain English summary of this codebase in 2-4 sentences.`,
      `Do not use headers or bullet points — write continuous prose.`,
      `Cover: what the system does, how it is structured, and the one thing a new developer must understand first.`,
      `Be specific — reference actual components or workflows from the data. Total length: 50-80 words.`,
    );

    return parts.join('\n');
  }
}
