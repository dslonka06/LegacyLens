export type SearchResultType =
  | 'file'
  | 'folder'
  | 'project'
  | 'workflow'
  | 'insight'
  | 'documentation'
  | 'repository-section';

// Where clicking a result should send the user, and what state to pre-select.
export interface SearchNavigationTarget {
  route: string;
  // For file/folder/workflow results: the dependency node id to pre-select
  // in Repository Navigation.
  nodeId?: string;
  nodeName?: string;
  nodePath?: string;
  // For documentation results: the section id to scroll to.
  sectionId?: string;
  // For insight results: the insight title to highlight.
  insightTitle?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  type: SearchResultType;
  // One-line context shown below the title in the results panel.
  description: string;
  // Where the result came from — used for the group header label.
  source: string;
  relevanceScore: number;
  navigationTarget: SearchNavigationTarget;
}
