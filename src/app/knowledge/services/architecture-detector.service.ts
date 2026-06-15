import { Injectable } from '@angular/core';
import { RepositoryStructure } from '../models/repository.model';
import { DependencyGraph, ArchitecturePattern, RepositoryArchitectureAnalysis } from '../models/knowledge.model';

// Each rule defines what folder names / dependency patterns signal a given architecture.
// Confidence is scaled by how many distinct indicators are present.
interface ArchitectureRule {
  name: string;
  // Folder name fragments (case-insensitive) that indicate this pattern
  folderIndicators: string[];
  // Minimum number of folder indicators required for a match
  minFolderMatches: number;
  // Baseline confidence when minFolderMatches are present
  baseConfidence: number;
  // Additional confidence gained per extra indicator beyond the minimum
  confidencePerExtra: number;
}

const ARCHITECTURE_RULES: ArchitectureRule[] = [
  {
    name: 'Clean Architecture',
    folderIndicators: ['domain', 'application', 'infrastructure', 'api', 'core'],
    minFolderMatches: 3,
    baseConfidence: 0.75,
    confidencePerExtra: 0.08,
  },
  {
    name: 'MVC',
    folderIndicators: ['controllers', 'models', 'views'],
    minFolderMatches: 2,
    baseConfidence: 0.70,
    confidencePerExtra: 0.15,
  },
  {
    name: 'CQRS',
    folderIndicators: ['commands', 'queries', 'handlers'],
    minFolderMatches: 2,
    baseConfidence: 0.75,
    confidencePerExtra: 0.12,
  },
  {
    name: 'Layered Architecture',
    folderIndicators: ['services', 'repositories', 'controllers', 'data', 'dal', 'bll'],
    minFolderMatches: 2,
    baseConfidence: 0.65,
    confidencePerExtra: 0.07,
  },
  {
    name: 'Microservice Architecture',
    // Multiple independently deployable projects each with their own project file
    folderIndicators: ['api', 'service', 'worker', 'gateway', 'proxy'],
    minFolderMatches: 2,
    baseConfidence: 0.60,
    confidencePerExtra: 0.10,
  },
  {
    name: 'Feature-Sliced Design',
    folderIndicators: ['features', 'entities', 'widgets', 'shared', 'pages'],
    minFolderMatches: 3,
    baseConfidence: 0.70,
    confidencePerExtra: 0.08,
  },
  {
    name: 'Hexagonal Architecture',
    folderIndicators: ['ports', 'adapters', 'domain', 'application'],
    minFolderMatches: 2,
    baseConfidence: 0.70,
    confidencePerExtra: 0.10,
  },
];

@Injectable({ providedIn: 'root' })
export class ArchitectureDetectorService {

  detect(
    structure: RepositoryStructure,
    graph: DependencyGraph
  ): RepositoryArchitectureAnalysis {
    const allFolderNames = this.collectFolderNames(structure);
    const patterns = this.detectPatterns(allFolderNames, structure, graph);

    // Only return patterns that meet the confidence threshold
    const significant = patterns
      .filter(p => p.confidence >= 0.50)
      .sort((a, b) => b.confidence - a.confidence);

    return { patterns: significant };
  }

  private detectPatterns(
    folderNames: Set<string>,
    structure: RepositoryStructure,
    graph: DependencyGraph
  ): ArchitecturePattern[] {
    const results: ArchitecturePattern[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      const matchedIndicators = rule.folderIndicators.filter(
        indicator => folderNames.has(indicator.toLowerCase())
      );

      if (matchedIndicators.length < rule.minFolderMatches) continue;

      const extra = matchedIndicators.length - rule.minFolderMatches;
      const rawConfidence = rule.baseConfidence + extra * rule.confidencePerExtra;

      // Microservice boost: check if we have multiple project files in separate roots
      let confidence = rawConfidence;
      if (rule.name === 'Microservice Architecture' && structure.projects.length >= 3) {
        confidence = Math.min(1.0, confidence + 0.15);
      }

      // Cap at 0.97 — we never claim certainty from folder names alone
      confidence = Math.min(0.97, confidence);

      results.push({
        name: rule.name,
        confidence: Math.round(confidence * 100) / 100,
        indicators: matchedIndicators,
      });
    }

    return results;
  }

  private collectFolderNames(structure: RepositoryStructure): Set<string> {
    const names = new Set<string>();
    this.walkFolder(structure.root, names);
    return names;
  }

  private walkFolder(
    folder: { name: string; children: any[]; files: any[] },
    accumulator: Set<string>
  ): void {
    if (folder.name) {
      accumulator.add(folder.name.toLowerCase());
    }
    for (const child of folder.children) {
      this.walkFolder(child, accumulator);
    }
  }
}
