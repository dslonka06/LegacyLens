import { Injectable } from '@angular/core';
import { WorkspaceType } from '../models/workspace.model';
import {
  GuideAnswers,
  GuideQuestion,
  GuideRecommendation,
  RecommendedPage,
  UserGoalId,
} from '../models/guide.model';

// ── Question definitions ──────────────────────────────────────────────────────

export const Q1: GuideQuestion = {
  id: 'q1',
  title: 'What are you trying to accomplish?',
  options: [
    { id: 'understand-system', label: 'I inherited an unfamiliar application' },
    { id: 'modify-code',       label: 'I need to modify existing code' },
    { id: 'modernize',         label: 'I need to modernize a legacy system' },
    { id: 'documentation',     label: 'I need documentation' },
    { id: 'onboard',           label: 'I need to onboard a teammate' },
    { id: 'exploring',         label: 'I am exploring the application' },
  ],
};

const Q2_BY_GOAL: Record<string, GuideQuestion> = {
  'understand-system': {
    id: 'q2',
    title: 'What would help you most?',
    options: [
      { id: 'how-it-works',       label: 'Understand how it works overall' },
      { id: 'architecture',       label: 'Understand the architecture' },
      { id: 'important-files',    label: 'Identify the important files' },
      { id: 'data-flow',          label: 'Understand how data moves through it' },
    ],
  },
  'modify-code': {
    id: 'q2',
    title: 'What concerns you most?',
    options: [
      { id: 'breaking-things',    label: 'Breaking existing functionality' },
      { id: 'affected-files',     label: 'Finding all affected files' },
      { id: 'dependencies',       label: 'Understanding the dependencies' },
      { id: 'finding-logic',      label: 'Finding where the logic lives' },
    ],
  },
  'modernize': {
    id: 'q2',
    title: 'What is the priority?',
    options: [
      { id: 'outdated-patterns',  label: 'Identify outdated patterns first' },
      { id: 'risk-areas',         label: 'Find the highest-risk areas' },
      { id: 'refactor-targets',   label: 'Find candidates for refactoring' },
      { id: 'full-assessment',    label: 'Get a full modernization assessment' },
    ],
  },
  'documentation': {
    id: 'q2',
    title: 'Who is the audience?',
    options: [
      { id: 'developer',          label: 'Developer' },
      { id: 'architect',          label: 'Architect' },
      { id: 'manager',            label: 'Manager' },
      { id: 'new-team-member',    label: 'New Team Member' },
    ],
  },
  'onboard': {
    id: 'q2',
    title: 'What does the new teammate need first?',
    options: [
      { id: 'overview',           label: 'A high-level system overview' },
      { id: 'key-files',          label: 'The most important files to read' },
      { id: 'architecture',       label: 'How the system is structured' },
      { id: 'full-guide',         label: 'A complete onboarding guide' },
    ],
  },
};

// ── Page catalogue ────────────────────────────────────────────────────────────

interface PageCatalogue {
  analysis:     RecommendedPage;
  repository:   RecommendedPage;
  architecture: RecommendedPage;
  dataFlow:     RecommendedPage;
  risks:        RecommendedPage;
  modernization:RecommendedPage;
  documentation:RecommendedPage;
}

const PAGES: PageCatalogue = {
  analysis:     { label: 'Analysis',              route: '/analysis',              reason: 'Understand what individual files do in plain English.' },
  repository:   { label: 'Repository Analysis',   route: '/repository-analysis',   reason: 'Explore the full structure, dependencies, and architecture.' },
  architecture: { label: 'Architecture',          route: '/architecture',          reason: 'See architectural patterns and how layers are organized.' },
  dataFlow:     { label: 'Data Flow',             route: '/data-flow',             reason: 'Trace how requests and data move through the system.' },
  risks:        { label: 'Risks & Issues',        route: '/risks',                 reason: 'Find dangerous coupling, high-risk areas, and known issues.' },
  modernization:{ label: 'Modernization',         route: '/modernization',         reason: 'Identify outdated patterns and prioritize what to improve.' },
  documentation:{ label: 'Documentation',         route: '/documentation',         reason: 'Generate tailored documentation for any audience.' },
};

// ── Recommendation table ──────────────────────────────────────────────────────

function rec(
  goal: UserGoalId,
  secondary: string,
  headline: string,
  summary: string,
  steps: string[],
  pages: RecommendedPage[]
): GuideRecommendation {
  return { primaryGoal: goal, secondaryGoal: secondary, headline, summary, steps, recommendedPages: pages };
}

const RECOMMENDATIONS: Record<string, GuideRecommendation> = {

  // ── Understand system ────────────────────────────────────────────────────

  'understand-system:how-it-works': rec(
    'understand-system', 'how-it-works',
    'Understanding an Inherited System',
    'Start with a high-level overview, then explore the repository structure and dependencies to build a complete picture.',
    [
      'Upload the repository or key files.',
      'Open Repository Analysis for a full system overview.',
      'Review detected architecture patterns.',
      'Explore the dependency graph to find the most important files.',
      'Use the Analysis page to deep-dive into specific components.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow, PAGES.analysis]
  ),

  'understand-system:architecture': rec(
    'understand-system', 'architecture',
    'Understanding the System Architecture',
    'Focus on architectural layers and patterns to quickly grasp how the application is organized.',
    [
      'Upload the repository.',
      'Open Repository Analysis and review detected architecture.',
      'Open the Architecture page for structural patterns.',
      'Review Data Flow to understand how layers communicate.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow]
  ),

  'understand-system:important-files': rec(
    'understand-system', 'important-files',
    'Finding the Most Important Files',
    'Use the dependency explorer to identify which files are central to the system.',
    [
      'Upload the repository.',
      'Open Repository Analysis.',
      'Review Dependency Rankings to find most-connected files.',
      'Analyze each key file individually on the Analysis page.',
    ],
    [PAGES.repository, PAGES.analysis, PAGES.architecture]
  ),

  'understand-system:data-flow': rec(
    'understand-system', 'data-flow',
    'Understanding Data Movement',
    'Trace how requests, services, and data move through the system from entry point to storage.',
    [
      'Upload the repository or relevant service files.',
      'Open Data Flow to trace request lifecycles.',
      'Review Architecture to understand layering.',
      'Analyze specific services on the Analysis page.',
    ],
    [PAGES.dataFlow, PAGES.architecture, PAGES.repository]
  ),

  // ── Modify code ──────────────────────────────────────────────────────────

  'modify-code:breaking-things': rec(
    'modify-code', 'breaking-things',
    'Safely Modifying Existing Code',
    'Before making changes, understand what depends on the files you are modifying.',
    [
      'Upload the files you plan to change.',
      'Open Repository Analysis and review incoming dependencies.',
      'Review Risks to identify high-coupling areas.',
      'Review Data Flow to understand downstream effects.',
      'Analyze the target file to confirm its responsibilities.',
    ],
    [PAGES.repository, PAGES.risks, PAGES.dataFlow, PAGES.analysis]
  ),

  'modify-code:affected-files': rec(
    'modify-code', 'affected-files',
    'Finding All Affected Files',
    'Use the dependency explorer to map everything connected to the code you plan to change.',
    [
      'Upload the repository.',
      'Open Repository Analysis.',
      'Find the target file in Dependency Rankings.',
      'Review its incoming and outgoing dependencies.',
      'Check Risks for known hotspots in that area.',
    ],
    [PAGES.repository, PAGES.risks, PAGES.analysis]
  ),

  'modify-code:dependencies': rec(
    'modify-code', 'dependencies',
    'Understanding Dependencies Before Changing Code',
    'Map the full dependency graph to understand the scope and risk of your change.',
    [
      'Upload the repository.',
      'Open Repository Analysis and review the dependency graph.',
      'Use Dependency Rankings to find highly connected files.',
      'Review Repository Insights for bottlenecks and god classes.',
      'Review Risks before proceeding.',
    ],
    [PAGES.repository, PAGES.risks, PAGES.dataFlow]
  ),

  'modify-code:finding-logic': rec(
    'modify-code', 'finding-logic',
    'Finding Where Logic Lives',
    'Use analysis and dependency mapping to locate specific business logic quickly.',
    [
      'Upload the relevant files or repository.',
      'Analyze key service files on the Analysis page.',
      'Review Architecture to understand which layer owns the logic.',
      'Use Data Flow to trace the request path to the logic.',
    ],
    [PAGES.analysis, PAGES.architecture, PAGES.dataFlow, PAGES.repository]
  ),

  // ── Modernize ────────────────────────────────────────────────────────────

  'modernize:outdated-patterns': rec(
    'modernize', 'outdated-patterns',
    'Identifying Outdated Patterns',
    'Start with a modernization scan to find the highest-value improvements.',
    [
      'Upload the legacy codebase.',
      'Analyze key files on the Analysis page.',
      'Open Modernization to review identified opportunities.',
      'Review Architecture to understand the current patterns.',
      'Prioritize changes with the lowest risk first.',
    ],
    [PAGES.modernization, PAGES.analysis, PAGES.architecture, PAGES.risks]
  ),

  'modernize:risk-areas': rec(
    'modernize', 'risk-areas',
    'Finding High-Risk Areas Before Modernizing',
    'Identify the most dangerous parts of the codebase before planning any refactoring.',
    [
      'Upload the repository.',
      'Open Repository Analysis and review Repository Insights.',
      'Open Risks to review detected risk areas.',
      'Review Modernization for related recommendations.',
      'Plan your modernization roadmap around the riskiest areas first.',
    ],
    [PAGES.risks, PAGES.repository, PAGES.modernization]
  ),

  'modernize:refactor-targets': rec(
    'modernize', 'refactor-targets',
    'Finding Refactoring Candidates',
    'Use dependency analysis to identify god classes, bottlenecks, and tightly coupled components.',
    [
      'Upload the repository.',
      'Open Repository Analysis and review Dependency Explorer.',
      'Look for god classes and dependency hotspots in Repository Insights.',
      'Review Modernization for pattern-based refactoring suggestions.',
      'Analyze individual candidates on the Analysis page.',
    ],
    [PAGES.repository, PAGES.modernization, PAGES.analysis]
  ),

  'modernize:full-assessment': rec(
    'modernize', 'full-assessment',
    'Full Modernization Assessment',
    'Run a comprehensive analysis covering risks, dependencies, architecture, and modernization opportunities.',
    [
      'Upload the complete repository.',
      'Open Repository Analysis for a structural overview.',
      'Review Architecture to understand the current design.',
      'Review Risks for high-risk areas.',
      'Review Modernization for a prioritized improvement list.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.risks, PAGES.modernization]
  ),

  // ── Documentation ────────────────────────────────────────────────────────

  'documentation:developer': rec(
    'documentation', 'developer',
    'Generating Developer Documentation',
    'Create technical documentation covering APIs, dependencies, data flow, and implementation details.',
    [
      'Upload the relevant codebase.',
      'Analyze key files on the Analysis page.',
      'Review Architecture and Data Flow.',
      'Open Documentation and generate Developer documentation.',
    ],
    [PAGES.analysis, PAGES.architecture, PAGES.dataFlow, PAGES.documentation]
  ),

  'documentation:architect': rec(
    'documentation', 'architect',
    'Generating Architecture Documentation',
    'Create high-level documentation covering system design, patterns, and component relationships.',
    [
      'Upload the repository.',
      'Open Repository Analysis for structural context.',
      'Review Architecture patterns.',
      'Open Documentation and generate Architecture documentation.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.documentation]
  ),

  'documentation:manager': rec(
    'documentation', 'manager',
    'Generating an Executive Summary',
    'Create a non-technical summary covering business purpose, risks, and modernization opportunities.',
    [
      'Upload the repository or key application files.',
      'Analyze the system on the Analysis page.',
      'Review Risks for a risk summary.',
      'Open Documentation and generate Management documentation.',
    ],
    [PAGES.analysis, PAGES.risks, PAGES.modernization, PAGES.documentation]
  ),

  'documentation:new-team-member': rec(
    'documentation', 'new-team-member',
    'Creating an Onboarding Guide',
    'Generate documentation that helps a new developer quickly understand and contribute to the system.',
    [
      'Upload the complete repository.',
      'Open Repository Analysis to understand the system structure.',
      'Review Architecture and Data Flow.',
      'Open Documentation and generate an Onboarding Guide.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow, PAGES.documentation]
  ),

  // ── Onboard ──────────────────────────────────────────────────────────────

  'onboard:overview': rec(
    'onboard', 'overview',
    'Onboarding: System Overview',
    'Give your new teammate a high-level picture of the system before diving into details.',
    [
      'Upload the repository.',
      'Open Repository Analysis and share the overview.',
      'Review Architecture to explain the system design.',
      'Walk through the Data Flow to show how it behaves.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow]
  ),

  'onboard:key-files': rec(
    'onboard', 'key-files',
    'Onboarding: Key Files First',
    'Help the new developer identify the most important files to read and understand first.',
    [
      'Upload the repository.',
      'Open Repository Analysis and review Dependency Rankings.',
      'Identify the most-connected files as the starting point.',
      'Analyze each key file on the Analysis page.',
    ],
    [PAGES.repository, PAGES.analysis]
  ),

  'onboard:architecture': rec(
    'onboard', 'architecture',
    'Onboarding: Architecture First',
    'Explain the architectural design so the new developer understands the big picture before touching code.',
    [
      'Upload the repository.',
      'Open Repository Analysis to review detected architecture.',
      'Open Architecture for detailed pattern explanations.',
      'Walk through Data Flow to explain component communication.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow]
  ),

  'onboard:full-guide': rec(
    'onboard', 'full-guide',
    'Onboarding: Complete Developer Guide',
    'Generate a full onboarding package covering everything a new developer needs.',
    [
      'Upload the complete repository.',
      'Open Repository Analysis for full context.',
      'Review Architecture, Risks, and Data Flow.',
      'Open Documentation and generate an Onboarding Guide.',
      'Share the generated documentation with your new teammate.',
    ],
    [PAGES.repository, PAGES.architecture, PAGES.dataFlow, PAGES.documentation]
  ),

  // ── Exploring ────────────────────────────────────────────────────────────

  'exploring:': rec(
    'exploring', '',
    'Exploring LegacyLens',
    'Start with the Analysis page for single-file understanding, or upload a repository for full intelligence.',
    [
      'Upload a file or folder using the Analysis page.',
      'Try analyzing a single file to see code understanding in action.',
      'Upload a full project and open Repository Analysis.',
      'Explore the Dependency Explorer and Architecture sections.',
    ],
    [PAGES.analysis, PAGES.repository, PAGES.architecture, PAGES.dataFlow]
  ),
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GuideEngineService {

  getQuestion1(): GuideQuestion {
    return Q1;
  }

  getQuestion2(q1Answer: string): GuideQuestion | null {
    return Q2_BY_GOAL[q1Answer] ?? null;
  }

  // Returns true if this goal skips Q2 and goes straight to recommendation
  skipQuestion2(q1Answer: string): boolean {
    return q1Answer === 'exploring';
  }

  buildRecommendation(answers: GuideAnswers, workspaceType?: WorkspaceType): GuideRecommendation {
    const key = `${answers.q1}:${answers.q2 ?? ''}`;
    const base = RECOMMENDATIONS[key] ?? RECOMMENDATIONS['exploring:'];

    // Workspace-aware enrichment — prepend upload step if no workspace loaded
    if (!workspaceType) {
      return {
        ...base,
        steps: [
          'Upload a file, project folder, or repository from the Analysis page.',
          ...base.steps,
        ],
      };
    }

    // For single-file goals when a repository is available, nudge toward repo analysis
    if (
      (workspaceType === 'Project' || workspaceType === 'Repository') &&
      answers.q1 === 'understand-system'
    ) {
      return {
        ...base,
        summary: base.summary + ' A repository is already loaded — start with Repository Analysis.',
      };
    }

    return base;
  }
}
