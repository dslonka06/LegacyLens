// Stage 1 single-file architecture analysis — produced by AnalysisService and AiAnalysisService.
// Contains flat string arrays derived from pattern matching or AI on a single source file.
//
// Not to be confused with RepositoryArchitectureAnalysis in knowledge.model.ts,
// which is produced by ArchitectureDetectorService from the full dependency graph
// and carries confidence scores and folder-based indicators.
export interface ArchitectureAnalysis {
  patterns: string[];
  responsibilities: string[];
  dependencies: string[];
}
