import { TechnologyDetectionResult } from './technology.model';
import { RepositoryStructure } from './repository.model';

export type WorkspaceType = 'SingleFile' | 'MultiFile' | 'Project' | 'Repository';

export interface FileMetadata {
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
}

export interface WorkspaceProfile {
  workspaceType: WorkspaceType;
  classificationConfidence: number;
  totalFiles: number;
  languages: string[];
  // Stage 1: flat technology list — kept for backward compatibility
  technologies: string[];
  projectFileCount: number;
  solutionFileCount: number;
  hasRepositoryIndicators: boolean;
  files: FileMetadata[];
  // Stage 2: enriched technology detection with confidence and method
  detectedTechnologies?: TechnologyDetectionResult[];
  // Stage 2: full folder/project structure — metadata only, no file contents
  repositoryStructure?: RepositoryStructure;
}

export interface Workspace {
  profile: WorkspaceProfile;
  rawFiles: File[];
}
