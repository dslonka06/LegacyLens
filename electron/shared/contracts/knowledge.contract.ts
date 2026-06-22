/**
 * Repository knowledge pipeline types — the output of the Repository Engine.
 * Shared between Angular renderer and Electron main process.
 */

import { SourceFile, DependencyGraph, RepositoryArchitectureAnalysis } from './repository.contract';

// ── Technology Detection ─────────────────────────────────────────────────────

export type TechnologyCategory =
  | 'Framework'
  | 'Runtime'
  | 'BuildTool'
  | 'ContainerOrOrchestration'
  | 'CI_CD'
  | 'Database'
  | 'TestingFramework'
  | 'PackageManager'
  | 'Other';

export type DetectionMethod = 'filename' | 'content' | 'dependency';

export interface TechnologyDetectionResult {
  technology: string;
  category: TechnologyCategory;
  confidence: number;
  detectionMethod: DetectionMethod;
  sourceFile: string;
}

// ── Knowledge State ──────────────────────────────────────────────────────────

export enum KnowledgeState {
  NotStarted            = 'NotStarted',
  ReadingFiles          = 'ReadingFiles',
  BuildingDependencies  = 'BuildingDependencies',
  DetectingArchitecture = 'DetectingArchitecture',
  Complete              = 'Complete',
  Failed                = 'Failed',
}

// ── Root Knowledge Aggregate ─────────────────────────────────────────────────

export interface RepositoryKnowledge {
  sourceFiles: SourceFile[];
  dependencyGraph?: DependencyGraph;
  architecture?: RepositoryArchitectureAnalysis;
  builtAt: string;
}
