import { Injectable } from '@angular/core';
import type { DataFlowAIAnalysis } from '@app/knowledge/models/data-flow-ai-analysis.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

export interface DataFlowSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  dataFlow: DataFlowAIAnalysis;
  architecture: ArchitectureAIAnalysis | null;
  totalFiles: number;
  languages: string[];
}

@Injectable({ providedIn: 'root' })
export class DataFlowSummaryPromptBuilder {
  build(ctx: DataFlowSummaryContext): string {
    const parts: string[] = [];
    const { dataFlow: df, architecture, scope } = ctx;

    const hasBottlenecks     = df.bottlenecks.length > 0;
    const hasExternalDeps    = df.externalDependencies.length > 0;
    const highRiskWorkflows  = df.primaryWorkflows.filter(w => w.failureRisk === 'High');
    const modRiskWorkflows   = df.primaryWorkflows.filter(w => w.failureRisk === 'Moderate');

    // ── Persona ───────────────────────────────────────────────────────────────
    parts.push(
      `You are a senior engineer who has traced the data flows through a codebase.`,
      `You are writing an assessment for the team responsible for operating and evolving this system.`,
      ``,
      `Your role is to reason about what the discovered workflows and behavioral patterns reveal`,
      `about operational risk — specifically: which flows are most likely to fail, where errors propagate,`,
      `and which nodes are structural bottlenecks that would amplify any failure.`,
      ``,
      `The workflow diagrams and node lists are shown elsewhere. Do not reproduce them.`,
      `Reason about what the shape of the data flow means for reliability and change safety.`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      ``,
    );

    // ── Output format ─────────────────────────────────────────────────────────
    if (scope === 'file') {
      parts.push(`Output: 1–2 sentences. What does the data flow through this file suggest about its operational role and risk?`);
    } else if (scope === 'folder') {
      parts.push(
        `Output: 2 short paragraphs, 80–130 words.`,
        `Paragraph 1: What do the discovered flows reveal about how data moves through this area?`,
        `Paragraph 2: Where are the structural risks for reliability and change isolation?`,
      );
    } else {
      parts.push(
        `Output: 3 paragraphs, 160–240 words.`,
        `Paragraph 1: What does the number and shape of discovered workflows reveal about the operational complexity of this system? Is it simple and linear, branching, or convergent?`,
        `Paragraph 2: Which workflow or node carries the most operational risk — if it fails or is modified incorrectly, what fails with it? What does the bottleneck structure tell you about how tightly coupled the system's behavior is?`,
        `Paragraph 3: What does the presence of external dependencies and data-access nodes tell you about the system's failure surface — specifically, which external integrations or data access patterns introduce the most risk?`,
      );
    }

    parts.push(``);

    // ── Evidence block ────────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);
    parts.push(`Size: ${ctx.totalFiles} files | Languages: ${ctx.languages.join(', ')}`);
    parts.push(``);

    parts.push(`Discovered workflows: ${df.workflowCount}`);

    if (df.primaryWorkflows.length > 0) {
      parts.push(``, `Workflow risk profiles:`);
      for (const wf of df.primaryWorkflows.slice(0, 6)) {
        const bottleneckNote = wf.bottleneckNodes.length > 0
          ? ` | bottlenecks: ${wf.bottleneckNodes.slice(0, 5).join(', ')}`
          : '';
        parts.push(`- ${wf.workflowName}: ${wf.stepCount} steps, entry: ${wf.entryPoint || 'unknown'}, risk: ${wf.failureRisk}${bottleneckNote}`);
      }
    }

    if (df.entryPoints.length > 0) {
      parts.push(``, `System entry points: ${df.entryPoints.slice(0, 6).join(', ')}`);
    }

    if (hasBottlenecks) {
      parts.push(`Structural bottlenecks (nodes that appear in multiple critical paths): ${df.bottlenecks.slice(0, 5).join(', ')}`);
    }

    if (df.mostReferenced.length > 0) {
      parts.push(`Most-referenced service nodes: ${df.mostReferenced.slice(0, 5).join(', ')}`);
    }

    if (df.dataAccessNodes.length > 0) {
      parts.push(`Data access nodes (repositories/stores): ${df.dataAccessNodes.slice(0, 5).join(', ')}`);
    }

    if (hasExternalDeps) {
      parts.push(`External integration nodes: ${df.externalDependencies.slice(0, 5).join(', ')}`);
    }

    if (highRiskWorkflows.length > 0) {
      parts.push(`High-risk workflows: ${highRiskWorkflows.map(w => w.workflowName).join(', ')}`);
    }
    if (modRiskWorkflows.length > 0) {
      parts.push(`Moderate-risk workflows: ${modRiskWorkflows.map(w => w.workflowName).join(', ')}`);
    }

    if (architecture) {
      parts.push(``, `Architecture context:`);
      parts.push(`Pattern: ${architecture.dominantPattern} | Coupling: ${architecture.couplingAssessment}`);
      if (architecture.circularDependencyCount > 0) {
        parts.push(`Circular dependencies: ${architecture.circularDependencyCount} — these can cause cascading flow failures`);
      }
    }

    parts.push(
      ``,
      `Reason about operational risk and failure propagation. Do not describe the flows — assess their implications.`,
    );

    return parts.join('\n');
  }
}
