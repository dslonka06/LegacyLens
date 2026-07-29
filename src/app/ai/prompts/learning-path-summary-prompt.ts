import { Injectable } from '@angular/core';
import type { LearningPathAnalysis } from '@app/analysis/models/learning-path-analysis.model';
import type { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';

export interface LearningPathSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  learningPath: LearningPathAnalysis;
  understanding: SystemUnderstanding | null;
  totalFiles: number;
  languages: string[];
}

@Injectable({ providedIn: 'root' })
export class LearningPathSummaryPromptBuilder {
  build(ctx: LearningPathSummaryContext): string {
    const parts: string[] = [];
    const { learningPath: lp, understanding, scope } = ctx;

    const firstStep = lp.roadmap[0] ?? null;
    const lastStep  = lp.roadmap[lp.roadmap.length - 1] ?? null;

    // ── Persona ───────────────────────────────────────────────────────────────
    parts.push(
      `You are a senior engineer who has thoroughly read a codebase and is now onboarding a developer to it.`,
      `You are writing the introductory paragraph that appears at the top of the learning guide.`,
      ``,
      `Your goal is to give that developer a mental model — an answer to the question:`,
      `"What kind of system is this, how is it meant to be understood, and what trap will I fall into if I start in the wrong place?"`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      `Do not reproduce the roadmap steps — that list is shown separately. Interpret the system's learning shape.`,
      ``,
    );

    // ── Output format ─────────────────────────────────────────────────────────
    if (scope === 'file') {
      parts.push(`Output: 1–2 sentences. What mental model does a developer need to understand this file in context?`);
    } else if (scope === 'folder') {
      parts.push(`Output: 2 short paragraphs, 80–130 words. What is the learning shape of this area and where should a developer start?`);
    } else {
      parts.push(
        `Output: 3 paragraphs, 150–220 words.`,
        `Paragraph 1: What kind of system is this from a learning perspective — is it a central hub with radiating concerns, a pipeline, a layered stack, or something else? What does its shape mean for how it should be learned?`,
        `Paragraph 2: What is the most common misconception a developer would form by reading the file structure alone, and what does the roadmap reveal about the correct mental model instead?`,
        `Paragraph 3: What is the single most important thing to understand before touching this system, and why does everything else depend on it?`,
      );
    }

    parts.push(``);

    // ── Evidence block ────────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);
    parts.push(`Type: ${lp.systemType || 'Unknown'} | Files: ${ctx.totalFiles} | Languages: ${ctx.languages.join(', ')}`);
    parts.push(``);

    if (lp.welcomeSummary) {
      parts.push(`System overview: ${lp.welcomeSummary}`);
    }

    if (lp.roadmap.length > 0) {
      parts.push(`Learning path length: ${lp.roadmap.length} steps`);
    }

    if (firstStep) {
      parts.push(`Recommended starting point: ${firstStep.title} — ${firstStep.description}`);
    }

    if (lastStep && lastStep !== firstStep) {
      parts.push(`Final step: ${lastStep.title} — ${lastStep.description}`);
    }

    if (lp.focusFirst) {
      parts.push(`Primary focus: ${lp.focusFirst}`);
    }

    if (understanding) {
      parts.push(``, `Understanding context (for background reasoning):`);
      parts.push(`Business criticality: ${understanding.businessCriticality}`);
      if (understanding.keyWorkflows.length > 0) {
        parts.push(`Key workflows: ${understanding.keyWorkflows.slice(0, 3).join(', ')}`);
      }
      if (understanding.coreCapabilities.length > 0) {
        parts.push(`Core capabilities: ${understanding.coreCapabilities.slice(0, 3).map(c => c.name).join(', ')}`);
      }
      if (understanding.highRiskAreas.length > 0) {
        parts.push(`High-risk areas: ${understanding.highRiskAreas.slice(0, 3).join(', ')}`);
      }
    }

    parts.push(
      ``,
      `Do not reproduce the roadmap. Give the developer a mental model and the one thing they must not get wrong.`,
    );

    return parts.join('\n');
  }
}
