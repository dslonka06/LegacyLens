/**
 * Workspace lifecycle and profile types.
 * Shared between Angular renderer and Electron main process.
 *
 * Note on WorkspaceType naming: Angular currently has two conflicting definitions.
 *   workspace.model.ts:        'SingleFile' | 'MultiFile' | 'Project' | 'Repository'  (classification result)
 *   workspace-entity.model.ts: 'file' | 'folder' | 'repository'                       (UI route/scope)
 *
 * This contract adopts both with distinct type names to eliminate the ambiguity.
 * Angular models will be reconciled against these in a future cleanup pass.
 */

import { TechnologyDetectionResult } from './knowledge.contract';
import { RepositoryStructure } from './repository.contract';

// The user-visible workspace scope — drives routing and sidebar context
export type WorkspaceScope = 'file' | 'folder' | 'repository';

// The classifier's assessment of what was uploaded
export type WorkspaceClassification = 'SingleFile' | 'MultiFile' | 'Project' | 'Repository';

export type WorkspaceStatus =
  | 'empty'      // created, nothing uploaded yet
  | 'loaded'     // content uploaded, analysis complete
  | 'analyzing'; // knowledge pipeline running

export const MAX_WORKSPACES = 3;

export interface WorkspaceProfile {
  workspaceType: WorkspaceClassification;
  classificationConfidence: number;
  totalFiles: number;
  languages: string[];
  technologies: string[];
  projectFileCount: number;
  solutionFileCount: number;
  hasRepositoryIndicators: boolean;
  files: import('./repository.contract').FileMetadata[];
  detectedTechnologies?: TechnologyDetectionResult[];
  repositoryStructure?: RepositoryStructure;
}

export interface WorkspaceContext {
  profile: WorkspaceProfile;
  uploadedAt: Date;
  workspaceName: string;
}
