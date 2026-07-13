import { Injectable } from '@angular/core';
import { WorkflowExplanationContext } from '@app/analysis/models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class WorkflowExplanationPromptBuilder {
  build(ctx: WorkflowExplanationContext): string {
    const parts: string[] = [];
    const wf = ctx.workflow;

    // ── Persona and constraints ───────────────────────────────────────────────
    parts.push(
      `You are a senior engineer helping a developer understand a specific workflow before they modify it.`,
      `The developer can already see the component sequence and step list in the UI.`,
      `Do not describe the flow path. Do not list the components in order.`,
      `Instead explain what the workflow means: why it exists, what it produces, where it can fail,`,
      `and what a developer must understand before changing it.`,
      `Write in plain prose. Use ## section headings. No bullet lists unless genuinely helpful.`,
      `Do not invent details not present in the data below.`,
      ``,
    );

    // ── Structured knowledge — context only, not to be narrated ──────────────
    parts.push(`Repository: ${ctx.workspaceName}`);

    if (ctx.architecturePatterns.length > 0) {
      parts.push(`Architecture: ${ctx.architecturePatterns.join(', ')}`);
    }

    parts.push(
      ``,
      `Workflow: ${wf.title}`,
      `Category: ${wf.category}`,
      `Confidence: ${Math.round(wf.confidence * 100)}%`,
      `Description: ${wf.description}`,
    );

    if (wf.flowPath.length > 0) {
      parts.push(`Component sequence: ${wf.flowPath.join(' → ')}`);
    }

    if (wf.steps.length > 0) {
      parts.push(``, `Detected steps:`);
      wf.steps.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
    }

    if (ctx.relatedNodeNames.length > 0) {
      parts.push(``, `Related components: ${ctx.relatedNodeNames.slice(0, 10).join(', ')}`);
    }

    // ── Task ─────────────────────────────────────────────────────────────────
    parts.push(
      ``,
      `Write an explanation with exactly these four sections. Each section should be 2-3 sentences.`,
      `Total length: 200-300 words. Reference specific components from the data where it adds insight.`,
      ``,
      `## What This Workflow Produces`,
      `What business outcome or user-facing result this workflow delivers.`,
      `Explain the purpose — not the steps. Why does this workflow need to exist?`,
      ``,
      `## Where It Can Break`,
      `What are the fragile points in this workflow. Where does it depend on external state,`,
      `timing, or contracts that could silently fail. What failure looks like from the outside.`,
      ``,
      `## What Couples This Workflow`,
      `Which components in this workflow carry the most responsibility or have the most dependencies.`,
      `What implicit contracts exist between components that a developer must not break.`,
      ``,
      `## Before You Modify This`,
      `What a developer should verify, test, or check before changing any part of this workflow.`,
      `Name specific things to look for — not generic advice like "write tests".`,
      `What downstream effects could a change here cause that are not immediately obvious.`,
    );

    return parts.join('\n');
  }
}
