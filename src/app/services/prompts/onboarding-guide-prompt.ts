import { Injectable } from '@angular/core';
import { OnboardingGuideContext } from '../../models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class OnboardingGuidePromptBuilder {

  build(ctx: OnboardingGuideContext): string {
    const parts: string[] = [];

    parts.push(
      `You are a senior engineer writing a practical onboarding guide for a developer joining a team working on this repository.`,
      `Write a guide that would genuinely help a developer become productive quickly.`,
      `Base the guide only on the structured knowledge provided below.`,
      `Be specific. Be practical. Avoid generic advice.`,
      ``,
    );

    parts.push(`## Repository: ${ctx.workspaceName}`);
    parts.push(`Type: ${ctx.workspaceType} | Files: ${ctx.totalFiles ?? 'unknown'}`);
    parts.push(`Languages: ${ctx.languages.join(', ') || 'unknown'}`);
    parts.push(`Technologies: ${ctx.technologies.join(', ') || 'none detected'}`);

    if (ctx.projectNames.length > 0) {
      parts.push(`Projects: ${ctx.projectNames.join(', ')}`);
    }

    if (ctx.executiveSummary) {
      parts.push(``, `## Repository Purpose`, ctx.executiveSummary);
    }

    if (ctx.architecturePatterns.length > 0) {
      parts.push(``, `## Architecture`);
      for (const p of ctx.architecturePatterns) {
        parts.push(`- ${p.name} (${Math.round(p.confidence * 100)}% confidence)`);
      }
    }

    if (ctx.topWorkflows.length > 0) {
      parts.push(``, `## Critical Workflows (start here)`);
      for (const wf of ctx.topWorkflows.slice(0, 4)) {
        parts.push(`- ${wf.title}: ${wf.description}`);
        if (wf.flowPath.length > 0) {
          parts.push(`  Path: ${wf.flowPath.slice(0, 5).join(' → ')}`);
        }
      }
    }

    if (ctx.keyFiles.length > 0) {
      parts.push(``, `## Key Files To Understand First`);
      for (const kf of ctx.keyFiles.slice(0, 8)) {
        parts.push(`- ${kf.name}: ${kf.reason}`);
      }
    }

    if (ctx.insights.length > 0) {
      const highRisk = ctx.insights.filter(i => i.severity === 'high' || i.severity === 'medium');
      if (highRisk.length > 0) {
        parts.push(``, `## Known Issues To Be Aware Of`);
        for (const ins of highRisk.slice(0, 4)) {
          parts.push(`- [${ins.severity.toUpperCase()}] ${ins.title}: ${ins.description}`);
        }
      }
    }

    if (ctx.dependencyStats) {
      parts.push(``, `## Codebase Scale`, `${ctx.dependencyStats.nodes} components with ${ctx.dependencyStats.edges} dependency connections`);
    }

    parts.push(
      ``,
      `## Your Task`,
      `Write a practical onboarding guide with these sections:`,
      ``,
      `### Repository Overview`,
      `What this system does. What problem it solves. Who uses it.`,
      ``,
      `### Technologies & Architecture`,
      `What the developer needs to know about the tech stack and how the code is organized.`,
      ``,
      `### Critical Workflows`,
      `The 2-3 most important workflows to understand first. For each: what it does and why it matters.`,
      ``,
      `### Recommended Learning Order`,
      `A concrete sequence of what to study first. Be specific about files or components.`,
      ``,
      `### Common Risks & Gotchas`,
      `What could go wrong. What to be careful about when making changes.`,
      ``,
      `### Suggested First Areas To Explore`,
      `Specific places to start reading code. Not generic — name actual components or workflows from the data.`,
      ``,
      `Each section should be 3-5 sentences. Total guide should be 400-600 words.`,
    );

    return parts.join('\n');
  }
}
