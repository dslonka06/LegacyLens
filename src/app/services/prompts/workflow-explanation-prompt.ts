import { Injectable } from '@angular/core';
import { WorkflowExplanationContext } from '../../models/ai-explanation-context.model';

@Injectable({ providedIn: 'root' })
export class WorkflowExplanationPromptBuilder {

  build(ctx: WorkflowExplanationContext): string {
    const parts: string[] = [];
    const wf = ctx.workflow;

    parts.push(
      `You are a senior software architect explaining a specific application workflow to a developer.`,
      `Explain the workflow clearly based only on the structured knowledge provided.`,
      `Do not invent details. Focus on what actually happens and why it matters.`,
      ``,
    );

    parts.push(`## Repository: ${ctx.workspaceName}`);

    if (ctx.architecturePatterns.length > 0) {
      parts.push(`Architecture: ${ctx.architecturePatterns.join(', ')}`);
    }

    parts.push(
      ``,
      `## Workflow: ${wf.title}`,
      `Category: ${wf.category}`,
      `Confidence: ${Math.round(wf.confidence * 100)}%`,
      `Description: ${wf.description}`,
    );

    if (wf.flowPath.length > 0) {
      parts.push(``, `## Component Flow`, wf.flowPath.join(' → '));
    }

    if (wf.steps.length > 0) {
      parts.push(``, `## Detected Steps`);
      wf.steps.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
    }

    if (ctx.relatedNodeNames.length > 0) {
      parts.push(``, `## Components Involved`, ctx.relatedNodeNames.slice(0, 10).join(', '));
    }

    parts.push(
      ``,
      `## Your Task`,
      `Write a structured explanation covering:`,
      `1. What this workflow does and its business purpose`,
      `2. Where it starts (entry point) and how it is triggered`,
      `3. The most important components and what each one does`,
      `4. How data or control moves through the workflow`,
      `5. Key dependencies a developer must understand before modifying this workflow`,
      `6. Any risk areas or things that could break if modified carelessly`,
      ``,
      `Keep each section to 2-3 sentences. Total response should be 200-350 words.`,
    );

    return parts.join('\n');
  }
}
