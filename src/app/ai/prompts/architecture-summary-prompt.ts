import { Injectable } from '@angular/core';
import type { ArchitectureAIAnalysis } from '@app/knowledge/models/architecture-ai-analysis.model';
import type { ArchitecturePattern } from '@app/knowledge/models/knowledge-model.contract';

export interface ArchitectureSummaryContext {
  workspaceName: string;
  scope: 'file' | 'folder' | 'repository';
  architecture: ArchitectureAIAnalysis;
  structuralPatterns: ArchitecturePattern[];
  totalFiles: number;
  languages: string[];
  technologies: string[];
}

@Injectable({ providedIn: 'root' })
export class ArchitectureSummaryPromptBuilder {
  build(ctx: ArchitectureSummaryContext): string {
    const parts: string[] = [];
    const { architecture: arch, structuralPatterns, scope } = ctx;

    const hasCompeting       = arch.competingPatterns.length > 0;
    const patternIsUncertain = arch.patternConfidence < 0.65;
    const hasHighCoupling    = arch.couplingAssessment === 'High' || arch.couplingAssessment === 'Critical';
    const hasCircularDeps    = arch.circularDependencyCount > 0;
    const hasBoundaryIssues  = arch.boundaryViolations.length > 0;

    // ── Persona ───────────────────────────────────────────────────────────────
    parts.push(
      `You are a software architect reviewing a codebase before advising its team.`,
      `You have been given the results of a structural architecture analysis.`,
      ``,
      `Your role is to reason about what the structural evidence reveals about`,
      `how this system was designed, how well that design held, and where the boundaries are breaking down.`,
      ``,
      `The detected patterns, layer breakdown, and coupling metrics are evidence.`,
      `Do not describe them — reason about what they mean together.`,
      `What does the combination of confidence score, competing patterns, coupling level, and circular`,
      `dependencies tell you about the architectural consistency and evolution risk of this system?`,
      ``,
      `Constraints: plain prose, no bullet lists, no headers, no invented details.`,
      `The layer breakdown and pattern list are shown elsewhere — do not reproduce them.`,
      ``,
    );

    // ── Output format ─────────────────────────────────────────────────────────
    if (scope === 'file') {
      parts.push(`Output: 1–2 sentences. What does the structural context of this file reveal about its role in the architecture?`);
    } else if (scope === 'folder') {
      parts.push(
        `Output: 2 short paragraphs, 80–130 words.`,
        `Paragraph 1: What architectural style governs this folder area and how consistently is it applied?`,
        `Paragraph 2: Where are the structural risks in this area?`,
      );
    } else {
      parts.push(
        `Output: 3–4 paragraphs, 180–260 words.`,
        `Paragraph 1: What does the dominant pattern and its confidence score tell you about how intentionally this architecture was designed vs how it emerged organically?`,
        `Paragraph 2: What do the coupling metrics and hub count tell you about where architectural pressure has accumulated — which parts of the system are load-bearing and therefore most risky to change?`,
        `Paragraph 3: If circular dependencies or competing patterns are present, what do they reveal about where the original design intent broke down?`,
        `Paragraph 4 (only if boundary violations detected): What does the presence of cross-layer components tell you about the long-term maintenance cost of this codebase?`,
      );
    }

    parts.push(``);

    // ── Evidence block ────────────────────────────────────────────────────────
    parts.push(`System: ${ctx.workspaceName}`);
    parts.push(`Size: ${ctx.totalFiles} files | Languages: ${ctx.languages.join(', ')}`);
    if (ctx.technologies.length > 0) {
      parts.push(`Technologies: ${ctx.technologies.join(', ')}`);
    }
    parts.push(``);

    parts.push(`Dominant detected pattern: ${arch.dominantPattern} (confidence: ${Math.round(arch.patternConfidence * 100)}%)`);

    if (hasCompeting) {
      const competing = arch.competingPatterns
        .slice(0, 3)
        .map(p => `${p.name} (${Math.round(p.confidence * 100)}%)`)
        .join(', ');
      parts.push(`Competing patterns also detected: ${competing}`);
    }

    if (patternIsUncertain) {
      parts.push(`Note: confidence below 65% — the dominant pattern was not strongly confirmed by folder structure`);
    }

    parts.push(`Coupling assessment: ${arch.couplingAssessment}`);
    parts.push(`Hub nodes (high inbound dependency count): ${arch.hubCount}`);
    parts.push(`Circular dependencies detected: ${arch.circularDependencyCount}`);
    parts.push(`Evolution risk: ${arch.evolutionRisk}`);

    if (hasCircularDeps && arch.circularDependencyCount > 0) {
      // The engine surfaces up to 10 node names — include them if available
      // (they come from the boundary violations cross-reference)
      parts.push(`Note: circular dependencies increase coupling and complicate change isolation`);
    }

    if (hasBoundaryIssues && arch.boundaryViolations.length > 0) {
      parts.push(``, `Detected boundary violations (components spanning multiple layers):`);
      for (const v of arch.boundaryViolations.slice(0, 5)) {
        parts.push(`- ${v}`);
      }
    }

    if (arch.layerBreakdown.length > 0) {
      parts.push(``, `Layer breakdown:`);
      for (const layer of arch.layerBreakdown) {
        const coupling = layer.couplingNotes ? ` [${layer.couplingNotes}]` : '';
        parts.push(`- ${layer.name}: ${layer.fileCount} nodes${coupling}`);
      }
    }

    // Include the raw structural pattern indicators for deeper context
    if (structuralPatterns.length > 0) {
      parts.push(``, `Structural detection indicators (folder names / patterns that triggered detection):`);
      for (const p of structuralPatterns.slice(0, 3)) {
        if (p.indicators.length > 0) {
          parts.push(`- ${p.name}: ${p.indicators.join(', ')}`);
        }
      }
    }

    parts.push(
      ``,
      `Reason about what the structural evidence means. Do not describe the data — interpret it.`,
      hasHighCoupling
        ? `The high coupling assessment is a key signal — reason about its implications.`
        : '',
    );

    return parts.filter(l => l !== undefined).join('\n');
  }
}
