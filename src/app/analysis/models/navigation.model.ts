// Stage 8 — Navigation models
// These answer "where is the user?" not "what is there?"
// Intelligence about a selected node lives in existing services; navigation
// context lives here.

import { DependencyNode } from '@app/knowledge/models/knowledge.model';
import { ChangeImpactAnalysis, WorkflowSummary } from './data-flow.model';

interface RepositoryInsight { title: string; description: string; severity: string; category: string; affectedFiles?: string[]; }

// How the user arrived at a node — used in history display to show
// the pattern of exploration (free-form vs. workflow-guided vs. search-driven).
export type NavigationSource =
  | 'file-tree'
  | 'dependency-link'
  | 'workflow-step'
  | 'search'
  | 'direct';

// A single entry in the navigation history stack.
// Names and paths are denormalized so the history panel can render
// without re-querying knowledge services.
export interface NavigationEntry {
  nodeId:    string;
  nodeName:  string;
  nodePath:  string;
  visitedAt: string;           // ISO timestamp
  source:    NavigationSource;
}

// A single segment in the breadcrumb trail for the selected node.
export interface Breadcrumb {
  label:  string;
  nodeId: string | null;       // null for non-navigable segments (workspace root)
  type:   'workspace' | 'folder' | 'file' | 'workflow';
}

// ── Per-node intelligence snapshot ───────────────────────────────────────────
// Produced by NodeIntelligenceFacade; consumed by navigation panels.

export interface NodeIntelligence {
  node:              DependencyNode;
  incoming:          DependencyNode[];
  outgoing:          DependencyNode[];
  touchingWorkflows: WorkflowSummary[];
  changeImpact:      ChangeImpactAnalysis;
  insights:          RepositoryInsight[];
  // Connectivity rank within the graph (1 = most connected). null when
  // the graph has no connectivity data for this node.
  connectivityRank:  number | null;
}
