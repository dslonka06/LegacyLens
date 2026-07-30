import { Injectable } from '@angular/core';
import type { DataFlowAIAnalysis } from '@app/knowledge/models/data-flow-ai-analysis.model';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';

export interface FileDataFlowContext {
  patternLabel: string;
  steps: string[];
  inputs: string[];
  outputs: string[];
  stepNarratives: string[];
}

export interface DataFlowSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  dataFlow: DataFlowAIAnalysis | null;
  fileDataFlow: FileDataFlowContext | null;
  architecture: ArchitectureAIAnalysis | null;
  totalFiles: number;
  languages: string[];
}

@Injectable({ providedIn: 'root' })
export class DataFlowSummaryPromptBuilder {
  build(ctx: DataFlowSummaryContext): string {
    if (ctx.scope === 'file' && ctx.fileDataFlow) {
      return this._buildFileScope(ctx);
    }
    return this._buildMultiFileScope(ctx);
  }

  private _buildFileScope(ctx: DataFlowSummaryContext): string {
    const parts: string[] = [];
    const fd = ctx.fileDataFlow!;

    parts.push(
      `You are a senior engineer reviewing the data flow of a single source file.`,
      `You are writing a brief for a developer who is about to read through this file's logic.`,
      ``,
      `The page already shows the individual flow steps with their descriptions, the input tags, and the output tags.`,
      `Your job is to give the overview that ties all of it together — the one paragraph a reader needs`,
      `before they start examining each step individually.`,
      ``,
      `Cover three things in natural prose:`,
      `1. What kind of flow this is and what it accomplishes end-to-end (the pattern, not the steps).`,
      `2. How the inputs feed into the pipeline and how the outputs relate to what was processed.`,
      `3. One observation about the flow's structure — is it linear, does it gate on a key step, is there a step that concentrates risk?`,
      ``,
      `Constraints: plain prose, 2–4 sentences, no bullet lists, no headers, no invented details.`,
      `Do not list the steps by name — the reader can see them. Reason about the shape and implications of the flow.`,
      ``,
    );

    parts.push(`File flow pattern: ${fd.patternLabel}`);
    parts.push(`Steps (${fd.steps.length}): ${fd.steps.join(' → ')}`);

    if (fd.inputs.length > 0) {
      parts.push(`Inputs: ${fd.inputs.join(', ')}`);
    }
    if (fd.outputs.length > 0) {
      parts.push(`Outputs: ${fd.outputs.join(', ')}`);
    }

    if (fd.stepNarratives.length > 0) {
      parts.push(``, `Step descriptions (for context — do not reproduce these verbatim):`);
      fd.stepNarratives.slice(0, 5).forEach((n, i) => {
        parts.push(`  Step ${i + 1} (${fd.steps[i]}): ${n.slice(0, 120)}${n.length > 120 ? '...' : ''}`);
      });
    }

    if (ctx.architecture) {
      parts.push(``, `File's architectural role: ${ctx.architecture.dominantPattern}`);
    }

    parts.push(
      ``,
      `Write the overview paragraph now. Tie together the pattern, inputs, outputs, and flow structure in 2–4 sentences.`,
    );

    return parts.join('\n');
  }

  private _buildMultiFileScope(ctx: DataFlowSummaryContext): string {
    const parts: string[] = [];
    const df = ctx.dataFlow!;
    const { architecture, scope } = ctx;

    const hasBottlenecks    = df.bottlenecks.length > 0;
    const hasExternalDeps   = df.externalDependencies.length > 0;
    const highRiskWorkflows = df.primaryWorkflows.filter(w => w.failureRisk === 'High');
    const modRiskWorkflows  = df.primaryWorkflows.filter(w => w.failureRisk === 'Moderate');

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

    if (scope === 'folder') {
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
      parts.push(`Structural bottlenecks: ${df.bottlenecks.slice(0, 5).join(', ')}`);
    }
    if (df.mostReferenced.length > 0) {
      parts.push(`Most-referenced service nodes: ${df.mostReferenced.slice(0, 5).join(', ')}`);
    }
    if (df.dataAccessNodes.length > 0) {
      parts.push(`Data access nodes: ${df.dataAccessNodes.slice(0, 5).join(', ')}`);
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
