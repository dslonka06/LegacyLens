import { Injectable } from '@angular/core';
import { RepositoryExplanationContext } from '../../models/ai-explanation-context.model';

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
        .map(p => `${p.name} (${Math.round(p.confidence * 100)}%)`)
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
      parts.push(`Dependency graph: ${ctx.dependencyStats.nodes} components, ${ctx.dependencyStats.edges} connections`);
    }

    // ── Task ─────────────────────────────────────────────────────────────────
    parts.push(
      ``,
      `Write an explanation with exactly these four sections. Each section should be 2-4 sentences.`,
      `Total length: 250-400 words. Be specific — reference actual components and workflows from the data.`,
      ``,
      `## Why This System Exists`,
      `What problem this repository solves. What business capability it provides. Who depends on it.`,
      `Explain the purpose, not the technology.`,
      ``,
      `## How It Is Built`,
      `What the architectural approach means in practice for this specific codebase.`,
      `Do not list technologies — explain why the architecture was chosen and what trade-offs it creates.`,
      `Focus on what a new developer needs to understand about how the pieces fit together.`,
      ``,
      `## Where To Start`,
      `Name the 2-3 most important workflows or components a developer should understand first, and explain`,
      `why those are the right starting points. Give a concrete learning path, not a generic recommendation.`,
      ``,
      `## What To Be Careful Changing`,
      `Based on the known risks and the dependency structure, what areas carry the highest modification risk.`,
      `Explain the implication — not just that a risk exists, but what could go wrong and why.`,
      `Do not repeat the risk titles verbatim. Synthesise them into developer guidance.`,
    );

    return parts.join('\n');
  }
}
