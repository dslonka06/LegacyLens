// ── User Goal identifiers ─────────────────────────────────────────────────────
export type UserGoalId =
  | 'understand-system'
  | 'modify-code'
  | 'modernize'
  | 'documentation'
  | 'onboard'
  | 'exploring';

// ── Decision tree nodes ───────────────────────────────────────────────────────

export interface GuideOption {
  id: string;
  label: string;
}

export interface GuideQuestion {
  id: string;
  title: string;
  options: GuideOption[];
}

// ── Recommendation output ─────────────────────────────────────────────────────

export interface RecommendedPage {
  label: string;       // Display name, e.g. "Repository Analysis"
  route: string;       // Angular route, e.g. "/repository-analysis"
  reason: string;      // One-sentence justification
}

export interface GuideRecommendation {
  primaryGoal: UserGoalId;
  secondaryGoal?: string;
  headline: string;    // e.g. "Understanding an Inherited System"
  summary: string;     // 1–2 sentence explanation of the recommended approach
  steps: string[];     // Ordered workflow steps
  recommendedPages: RecommendedPage[];
}

// ── Guide session state ───────────────────────────────────────────────────────

export interface GuideAnswers {
  q1: string;
  q2?: string;
}

// ── Future: Documentation audience (Stage 6 foundation) ─────────────────────

export type DocumentationAudience =
  | 'developer'
  | 'architect'
  | 'manager'
  | 'new-team-member';

export interface DocumentationAudienceInfo {
  id: DocumentationAudience;
  label: string;
  description: string;
  // Which documentation sections are most relevant for this audience
  emphasizedSections: string[];
}

export const DOCUMENTATION_AUDIENCES: DocumentationAudienceInfo[] = [
  {
    id: 'developer',
    label: 'Developer',
    description: 'Detailed technical documentation including APIs, dependencies, and implementation notes.',
    emphasizedSections: ['architecture', 'data-flow', 'risks', 'dependencies'],
  },
  {
    id: 'architect',
    label: 'Architect',
    description: 'High-level architecture patterns, system relationships, and structural overview.',
    emphasizedSections: ['architecture', 'dependencies', 'modernization'],
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Executive summary, business purpose, risk overview, and modernization opportunities.',
    emphasizedSections: ['summary', 'risks', 'modernization'],
  },
  {
    id: 'new-team-member',
    label: 'New Team Member',
    description: 'Onboarding guide with key files, important concepts, and where to start.',
    emphasizedSections: ['summary', 'architecture', 'data-flow', 'documentation'],
  },
];
