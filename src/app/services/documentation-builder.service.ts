import { Injectable } from '@angular/core';
import { UserGoalId } from '../models/guide.model';
import {
  DocumentationSection,
  DocumentationSectionId,
  RepositorySummary,
} from '../models/repository-summary.model';

// Section catalogue — ordered as they appear in the builder UI
const ALL_SECTIONS: Omit<DocumentationSection, 'available' | 'recommended'>[] = [
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
    description: 'Outdated patterns, technical debt, and recommended improvements.',
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
    description: 'High-coupling components, system hubs, broad-scope files, and orphans.',
  },
  {
    id: 'onboarding-guide',
    title: 'Onboarding Guide',
    description: 'Step-by-step guide for a new developer joining this project.',
  },
];

// Goal → recommended section IDs
const GOAL_RECOMMENDATIONS: Record<UserGoalId, DocumentationSectionId[]> = {
  'understand-system': [
    'executive-summary', 'repository-overview', 'architecture-overview', 'key-files', 'onboarding-guide',
  ],
  'modify-code': [
    'risk-assessment', 'dependency-analysis', 'key-files', 'data-flow',
  ],
  'modernize': [
    'risk-assessment', 'architecture-overview', 'dependency-analysis', 'modernization',
  ],
  'documentation': [
    'executive-summary', 'architecture-overview', 'data-flow', 'key-projects', 'onboarding-guide',
  ],
  'onboard': [
    'executive-summary', 'architecture-overview', 'key-files', 'onboarding-guide',
  ],
  'exploring': [
    'executive-summary', 'repository-overview', 'architecture-overview',
  ],
};

@Injectable({ providedIn: 'root' })
export class DocumentationBuilderService {

  // Build the full section list, marking availability and recommendations.
  buildSectionList(
    summary: RepositorySummary,
    goalId: UserGoalId | null,
  ): DocumentationSection[] {
    const recommended = new Set<DocumentationSectionId>(
      goalId ? (GOAL_RECOMMENDATIONS[goalId] ?? []) : []
    );

    return ALL_SECTIONS.map(s => ({
      ...s,
      available: this.isSectionAvailable(s.id, summary),
      recommended: recommended.has(s.id),
    }));
  }

  // Returns the default pre-selected section IDs for a given goal.
  defaultSelections(goalId: UserGoalId | null, summary: RepositorySummary): DocumentationSectionId[] {
    const all = this.buildSectionList(summary, goalId);
    return all
      .filter(s => s.available && (goalId ? s.recommended : true))
      .map(s => s.id);
  }

  // Render selected sections as a structured plain-text document for preview.
  renderPreview(summary: RepositorySummary, selectedIds: DocumentationSectionId[]): string {
    const lines: string[] = [];
    let sectionNum = 1;

    for (const id of selectedIds) {
      const section = ALL_SECTIONS.find(s => s.id === id);
      if (!section || !this.isSectionAvailable(id, summary)) continue;

      lines.push(`${sectionNum}. ${section.title}`);
      lines.push('─'.repeat(section.title.length + 4));
      lines.push(this.renderSectionContent(id, summary));
      lines.push('');
      sectionNum++;
    }

    return lines.join('\n');
  }

  private isSectionAvailable(id: DocumentationSectionId, summary: RepositorySummary): boolean {
    switch (id) {
      case 'executive-summary':    return !!summary.executiveSummary;
      case 'repository-overview':  return !!summary.repositoryOverview;
      case 'architecture-overview':return !!(summary.architectureSummary || summary.architecturePatterns?.length);
      case 'data-flow':            return !!summary.dataFlowSummary;
      case 'dependency-analysis':  return !!summary.dependencyStats;
      case 'risk-assessment':      return (summary.risks?.length ?? 0) > 0;
      case 'modernization':        return (summary.modernizations?.length ?? 0) > 0;
      case 'key-files':            return (summary.keyFiles?.length ?? 0) > 0;
      case 'key-projects':         return (summary.keyProjects?.length ?? 0) > 0;
      case 'repository-insights':  return (summary.insights?.length ?? 0) > 0;
      case 'onboarding-guide':     return !!(summary.onboardingNotes || summary.onboardingSteps?.length);
    }
  }

  private renderSectionContent(id: DocumentationSectionId, s: RepositorySummary): string {
    switch (id) {
      case 'executive-summary':
        return s.executiveSummary ?? '';

      case 'repository-overview':
        return [
          s.repositoryOverview ?? '',
          `Workspace Type: ${s.workspaceType}`,
          `Total Files: ${s.totalFiles}`,
          s.languages.length ? `Languages: ${s.languages.join(', ')}` : '',
          s.technologies.length ? `Technologies: ${s.technologies.slice(0, 8).join(', ')}` : '',
        ].filter(Boolean).join('\n');

      case 'architecture-overview':
        return [
          s.architectureSummary ?? '',
          ...(s.architecturePatterns?.map(p =>
            `• ${p.name} (${Math.round(p.confidence * 100)}%) — indicators: ${p.indicators.join(', ')}`
          ) ?? []),
        ].filter(Boolean).join('\n');

      case 'data-flow':
        return s.dataFlowSummary ?? '';

      case 'dependency-analysis':
        return [
          s.dependencySummary ?? '',
          s.dependencyStats ? `Nodes: ${s.dependencyStats.nodes} · Edges: ${s.dependencyStats.edges} · Avg connectivity: ${s.dependencyStats.averageConnectivity}` : '',
        ].filter(Boolean).join('\n');

      case 'risk-assessment':
        return (s.risks ?? []).map(r => `[${r.severity.toUpperCase()}] ${r.title}\n  ${r.description}`).join('\n');

      case 'modernization':
        return (s.modernizations ?? []).map(m => `• ${m.title}\n  ${m.description}`).join('\n');

      case 'key-files':
        return (s.keyFiles ?? []).map(f => `• ${f.name}${f.reason ? ' — ' + f.reason : ''}`).join('\n');

      case 'key-projects':
        return (s.keyProjects ?? []).map(p => `• ${p.name} (${p.type}) — ${p.framework} / ${p.language}`).join('\n');

      case 'repository-insights':
        return (s.insights ?? []).filter(i => i.severity !== 'info').map(i => `[${i.severity.toUpperCase()}] ${i.title}\n  ${i.description}`).join('\n');

      case 'onboarding-guide':
        return [
          s.onboardingNotes ?? '',
          ...(s.onboardingSteps?.map((step, i) => `${i + 1}. ${step}`) ?? []),
        ].filter(Boolean).join('\n');
    }
  }
}
