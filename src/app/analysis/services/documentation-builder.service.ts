import { Injectable } from '@angular/core';
import { DocumentationSection, DocumentationSectionId } from '../models/repository-summary.model';
import type { KnowledgeModel } from '@app/knowledge/models/knowledge-model.contract';

export type DocumentationScope = 'file' | 'folder' | 'repository';

// ── Section catalogue ──────────────────────────────────────────────────────────

interface SectionDef {
  id: DocumentationSectionId;
  title: string;
  description: string;
}

const REPO_SECTIONS: SectionDef[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    description: 'High-level overview of what this system is and what it does.',
  },
  {
    id: 'repository-overview',
    title: 'Repository Overview',
    description: 'File counts, folder structure, projects, and workspace statistics.',
  },
  {
    id: 'architecture-overview',
    title: 'Architecture Overview',
    description: 'Detected architectural patterns, layers, and structural design.',
  },
  {
    id: 'data-flow',
    title: 'Data Flow Analysis',
    description: 'How data moves through the system — requests, services, and storage.',
  },
  {
    id: 'dependency-analysis',
    title: 'Dependency Analysis',
    description: 'Dependency graph statistics, most-connected files, and coupling metrics.',
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Identified risks, high-coupling areas, and change-impact concerns.',
  },
  {
    id: 'modernization',
    title: 'Modernization Opportunities',
    description: 'Technical debt and recommended improvements.',
  },
  {
    id: 'key-files',
    title: 'Key Files',
    description: 'The most important files to understand the system.',
  },
  {
    id: 'key-projects',
    title: 'Key Projects',
    description: 'Discovered projects with their types, frameworks, and languages.',
  },
  {
    id: 'repository-insights',
    title: 'Repository Insights',
    description: 'High-coupling components, system hubs, and orphan files.',
  },
  {
    id: 'onboarding-guide',
    title: 'Onboarding Guide',
    description: 'Step-by-step guide for a new developer joining this project.',
  },
];

const FOLDER_SECTIONS: SectionDef[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    description: 'High-level overview of what this folder contains and does.',
  },
  {
    id: 'repository-overview',
    title: 'Folder Overview',
    description: 'File counts, subfolder structure, and workspace statistics.',
  },
  {
    id: 'architecture-overview',
    title: 'Architecture Overview',
    description: 'Detected architectural patterns, layers, and structural design.',
  },
  {
    id: 'data-flow',
    title: 'Data Flow Analysis',
    description: 'How data moves through the modules in this folder.',
  },
  {
    id: 'dependency-analysis',
    title: 'Dependency Analysis',
    description: 'Dependency graph statistics, most-connected files, and coupling metrics.',
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Identified risks, high-coupling areas, and change-impact concerns.',
  },
  {
    id: 'modernization',
    title: 'Modernization Opportunities',
    description: 'Technical debt and recommended improvements.',
  },
  {
    id: 'key-files',
    title: 'Key Files',
    description: 'The most important files to understand this folder.',
  },
  {
    id: 'onboarding-guide',
    title: 'Onboarding Guide',
    description: 'Step-by-step guide for a new developer working in this folder.',
  },
];

const FILE_SECTIONS: SectionDef[] = [
  {
    id: 'executive-summary',
    title: 'System Understanding',
    description: 'What this file is and what it is responsible for.',
  },
  {
    id: 'architecture-overview',
    title: 'Architecture',
    description: 'Detected patterns, responsibilities, and structural role of this file.',
  },
  {
    id: 'data-flow',
    title: 'Data Flow',
    description: 'How data enters, moves through, and exits this file.',
  },
  {
    id: 'risk-assessment',
    title: 'Security',
    description: 'Identified risks and code quality concerns in this file.',
  },
  {
    id: 'modernization',
    title: 'Recommendations',
    description: 'Recommended improvements for this file.',
  },
  {
    id: 'onboarding-guide',
    title: 'Learning Path',
    description: 'How to get up to speed with this file quickly.',
  },
];

function sectionsForScope(scope: DocumentationScope): SectionDef[] {
  if (scope === 'file') return FILE_SECTIONS;
  if (scope === 'folder') return FOLDER_SECTIONS;
  return REPO_SECTIONS;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DocumentationBuilderService {
  /**
   * Build the section list for the given KnowledgeModel.
   * Availability is gated on model.capabilities — never on targetType directly.
   */
  buildSectionList(model: KnowledgeModel): DocumentationSection[] {
    const scope = model.targetType as DocumentationScope;
    return sectionsForScope(scope).map((s) => ({
      ...s,
      available: this.isSectionAvailable(s.id, model),
    }));
  }

  defaultSelections(model: KnowledgeModel): DocumentationSectionId[] {
    return this.buildSectionList(model)
      .filter((s) => s.available)
      .map((s) => s.id);
  }

  /**
   * Render selected sections as structured plain-text for the preview panel.
   * This is a pure assembly — nothing is computed or fetched here.
   */
  renderPreview(model: KnowledgeModel, selectedIds: DocumentationSectionId[]): string {
    const scope = model.targetType as DocumentationScope;
    const catalogue = sectionsForScope(scope);
    const sections: string[] = [];
    let n = 1;

    for (const id of selectedIds) {
      const section = catalogue.find((s) => s.id === id);
      if (!section || !this.isSectionAvailable(id, model)) continue;
      const content = this.renderSectionContent(id, model).trim();
      if (!content) continue;
      sections.push(`${n}. ${section.title}\n\n${content}`);
      n++;
    }

    return sections.join('\n\n');
  }

  // ── Availability ─────────────────────────────────────────────────────────────

  private isSectionAvailable(id: DocumentationSectionId, model: KnowledgeModel): boolean {
    const caps = model.capabilities;
    const ai = model.ai;
    const isFile = model.targetType === 'file';

    switch (id) {
      case 'executive-summary':
        return isFile
          ? !!ai?.understanding
          : !!ai?.understanding?.executiveSummary;

      case 'repository-overview':
        return model.structure.totalFiles > 0;

      case 'architecture-overview':
        return isFile
          ? false
          : caps.includes('architectureDiscovery') &&
              (model.relationships.architecture?.patterns.length ?? 0) > 0;

      case 'data-flow':
        return isFile
          ? !!(ai?.dataFlowFileNarrative || ai?.summaries?.dataFlow?.content)
          : caps.includes('dependencyResolution') &&
              (model.relationships.dependencies?.graph.nodes.length ?? 0) >= 3;

      case 'dependency-analysis':
        return (
          caps.includes('dependencyResolution') &&
          (model.relationships.dependencies?.graph.edges.length ?? 0) > 0
        );

      case 'risk-assessment':
        return isFile
          ? !!ai?.security
          : (ai?.security?.findings.length ?? 0) > 0;

      case 'modernization':
        return isFile
          ? !!(ai?.recommendations?.recommendations.length || ai?.summaries?.recommendations?.content)
          : (ai?.recommendations?.recommendations.length ?? 0) > 0;

      case 'key-files':
        return (
          (model.relationships.dependencies?.ranks.length ?? 0) > 0 ||
          (model.structure.symbols && Object.keys(model.structure.symbols).length > 0)
        );

      case 'key-projects':
        return caps.includes('multiProject') && (model.structure.projects?.length ?? 0) > 0;

      case 'repository-insights':
        return (
          caps.includes('dependencyResolution') &&
          (model.relationships.dependencies?.hubs.length ?? 0) > 0
        );

      case 'onboarding-guide':
        return isFile
          ? !!(ai?.learningPath || ai?.summaries?.learningPath?.content)
          : !!ai?.learningPath;
    }
  }

  // ── Content rendering ─────────────────────────────────────────────────────────

  private renderSectionContent(id: DocumentationSectionId, model: KnowledgeModel): string {
    const s = model.structure;
    const rel = model.relationships;
    const ins = model.insights;
    const ai = model.ai;
    const isFile = model.targetType === 'file';

    switch (id) {
      case 'executive-summary':
        if (!isFile) return ai?.understanding?.executiveSummary ?? '';
        return this._renderFileUnderstanding(ai);

      case 'repository-overview': {
        const lines = [
          `Workspace: ${model.workspaceName ?? 'Unknown'}`,
          `Type: ${model.targetType}`,
          `Total Files: ${s.totalFiles}`,
          s.languages.length ? `Languages: ${s.languages.join(', ')}` : '',
          s.frameworks.length ? `Frameworks: ${s.frameworks.join(', ')}` : '',
          s.technologies.length
            ? `Technologies: ${s.technologies
                .slice(0, 8)
                .map((t) => t.technology ?? String(t))
                .join(', ')}`
            : '',
        ];
        return lines.filter(Boolean).join('\n');
      }

      case 'architecture-overview': {
        const patterns = rel.architecture?.patterns ?? [];
        return patterns
          .map((p) => `- ${p.name} (${Math.round((p.confidence ?? 0) * 100)}%) - ${p.indicators.join(', ')}`)
          .join('\n');
      }

      case 'data-flow': {
        if (isFile) return this._renderFileDataFlow(ai, ins.dataFlow);
        const graph = rel.dependencies?.graph;
        if (!graph) return '';
        const nodeMap = new Map(graph.nodes.map((n) => [n.id, n.name]));
        const counts = new Map<string, number>();
        graph.edges.forEach((e) => counts.set(e.target, (counts.get(e.target) ?? 0) + 1));
        const top = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id, c]) => `- ${nodeMap.get(id) ?? id} (${c} dependents)`);
        return [`Top dependency targets:`, ...top].join('\n');
      }

      case 'dependency-analysis': {
        const graph = rel.dependencies?.graph;
        if (!graph) return '';
        const avgConn =
          graph.nodes.length > 0 ? (graph.edges.length / graph.nodes.length).toFixed(1) : '0';
        return [
          `Nodes: ${graph.nodes.length} | Edges: ${graph.edges.length} | Avg connectivity: ${avgConn}`,
          ...(rel.dependencies?.hubs
            .slice(0, 5)
            .map((h) => `- Hub: ${h.name} (${h.inboundCount} inbound)`) ?? []),
        ].join('\n');
      }

      case 'risk-assessment': {
        if (isFile) return this._renderFileSecurity(ai);
        return (ai?.security?.findings ?? [])
          .slice(0, 10)
          .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.issueDescription}`)
          .join('\n');
      }

      case 'modernization': {
        if (isFile) return this._renderFileRecommendations(ai);
        return (ai?.recommendations?.recommendations ?? [])
          .filter((r) => r.category === 'modernization' || r.category === 'technical-debt')
          .slice(0, 10)
          .map((r) => `- ${r.title}\n  ${r.recommendedImprovement}`)
          .join('\n');
      }

      case 'key-files': {
        const ranks = rel.dependencies?.ranks ?? [];
        if (ranks.length) {
          return ranks
            .slice(0, 10)
            .map((r, i) => `${i + 1}. ${r.name} (degree: ${r.degree})`)
            .join('\n');
        }
        return Object.keys(s.symbols)
          .slice(0, 10)
          .map((p) => `- ${p}`)
          .join('\n');
      }

      case 'key-projects':
        return (s.projects ?? [])
          .map((p) => `- ${p.name} (${p.type}) - ${p.framework} / ${p.language}`)
          .join('\n');

      case 'repository-insights':
        return (rel.dependencies?.hubs ?? [])
          .filter((h) => h.isHub)
          .slice(0, 10)
          .map((h) => `- ${h.name} - ${h.inboundCount} inbound connections`)
          .join('\n');

      case 'onboarding-guide': {
        if (isFile) return this._renderFileLearningPath(ai);
        const lp = ai?.learningPath;
        if (!lp) return '';
        const steps = (lp.roadmap ?? [])
          .slice(0, 5)
          .map((step) => `${step.stepNumber}. ${step.title}\n   ${step.description}`);
        return [lp.focusFirst ? `Start here: ${lp.focusFirst}` : '', ...steps]
          .filter(Boolean)
          .join('\n');
      }
    }
  }

  // ── File-scope section renderers ──────────────────────────────────────────────

  private _renderFileUnderstanding(ai: KnowledgeModel['ai']): string {
    const u = ai?.understanding;
    const llm = ai?.summaries?.understanding?.content;
    const paras: string[] = [];

    if (llm) paras.push(llm);

    if (u?.executiveSummary && u.executiveSummary !== llm) paras.push(u.executiveSummary);

    const purposeParts: string[] = [];
    if (u?.businessPurpose) purposeParts.push(u.businessPurpose);
    if (u?.whyItMatters)    purposeParts.push(u.whyItMatters);
    if (purposeParts.length) paras.push(purposeParts.join(' '));

    if (u?.keyResponsibilities?.length) {
      const respNarratives = ai?.fileResponsibilitiesNarrative ?? [];
      const respParas = u.keyResponsibilities.map((r, i) => {
        const desc = respNarratives[i];
        return desc ? `${r}: ${desc}` : r;
      });
      paras.push(respParas.join('\n\n'));
    }

    if (u?.businessCriticalityReason) paras.push(u.businessCriticalityReason);
    if (u?.health?.interpretation)    paras.push(u.health.interpretation);

    return paras.join('\n\n');
  }

  private _renderFileDataFlow(ai: KnowledgeModel['ai'], insight?: KnowledgeModel['insights']['dataFlow']): string {
    const llm       = ai?.summaries?.dataFlow?.content;
    const narrative = ai?.dataFlowFileNarrative;
    const paras: string[] = [];

    if (llm) paras.push(llm);

    const summaryParts: string[] = [];
    if (narrative?.pattern?.label) summaryParts.push(`This is a ${narrative.pattern.label} flow.`);
    if (insight?.inputs?.length)   summaryParts.push(`It receives ${insight.inputs.join(', ')} as input.`);
    if (insight?.steps?.length)    summaryParts.push(`Processing moves through ${insight.steps.join(' -> ')}.`);
    if (insight?.outputs?.length)  summaryParts.push(`The flow produces ${insight.outputs.join(', ')}.`);
    if (summaryParts.length) paras.push(summaryParts.join(' '));

    if (narrative?.stepNarrative?.length) {
      const stepParas = narrative.stepNarrative.map((desc, i) => {
        const stepName = insight?.steps?.[i];
        return stepName ? `${stepName}: ${desc}` : desc;
      });
      paras.push(stepParas.join('\n\n'));
    }

    return paras.join('\n\n');
  }

  private _renderFileSecurity(ai: KnowledgeModel['ai']): string {
    const llm      = ai?.summaries?.security?.content;
    const security = ai?.security;
    const paras: string[] = [];

    if (llm) paras.push(llm);

    const actionableChecks = (security?.verificationChecks ?? []).filter(c => c.status !== 'pass');
    if (actionableChecks.length) {
      const checkParas = actionableChecks.map(c => {
        const prefix = c.status === 'fail' ? 'Fail' : 'Warning';
        return c.detail ? `${prefix} - ${c.summary} ${c.detail}` : `${prefix} - ${c.summary}`;
      });
      paras.push(checkParas.join('\n\n'));
    }

    const findings = security?.findings ?? [];
    if (findings.length) {
      const findingParas = findings.map(f => {
        const parts = [`[${f.severity.toUpperCase()}] ${f.title}. ${f.issueDescription}`];
        if (f.remediation) parts.push(`Remediation: ${f.remediation}`);
        return parts.join(' ');
      });
      paras.push(findingParas.join('\n\n'));
    } else if (security) {
      paras.push('No security findings were identified in this file.');
    }

    return paras.join('\n\n');
  }

  private _renderFileRecommendations(ai: KnowledgeModel['ai']): string {
    const llm  = ai?.summaries?.recommendations?.content;
    const recs = ai?.recommendations;
    const paras: string[] = [];

    if (llm) paras.push(llm);

    if (recs?.debtContext) paras.push(recs.debtContext);

    const items = recs?.recommendations ?? [];
    if (items.length) {
      const recParas = items.map(r => {
        const parts = [`[${r.priority.toUpperCase()}] ${r.title}. ${r.issueDescription}`];
        if (r.recommendedImprovement) parts.push(r.recommendedImprovement);
        return parts.join(' ');
      });
      paras.push(recParas.join('\n\n'));
    } else if (recs) {
      paras.push('No structural improvements were identified for this file.');
    }

    return paras.join('\n\n');
  }

  private _renderFileLearningPath(ai: KnowledgeModel['ai']): string {
    const llm = ai?.summaries?.learningPath?.content;
    const lp  = ai?.learningPath;
    const paras: string[] = [];

    if (llm) paras.push(llm);

    if (lp?.welcomeSummary && lp.welcomeSummary !== llm) paras.push(lp.welcomeSummary);

    if (lp?.focusFirst) paras.push(`Start here: ${lp.focusFirst}`);

    if (lp?.roadmap?.length) {
      const stepParas = lp.roadmap.map(step => {
        const parts = [`Step ${step.stepNumber}: ${step.title}.`];
        if (step.description) parts.push(step.description);
        if (step.whyHere)     parts.push(step.whyHere);
        return parts.join(' ');
      });
      paras.push(stepParas.join('\n\n'));
    }

    return paras.join('\n\n');
  }
}
