'use strict';

const ARCHITECTURE_RULES = [
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

class ArchitectureDetectorEngine {

  detect(structure, graph) {
    const allFolderNames = this.collectFolderNames(structure);
    const patterns = this.detectPatterns(allFolderNames, structure, graph);

    const significant = patterns
      .filter(p => p.confidence >= 0.50)
      .sort((a, b) => b.confidence - a.confidence);

    return { patterns: significant };
  }

  detectPatterns(folderNames, structure, graph) {
    const results = [];

    for (const rule of ARCHITECTURE_RULES) {
      const matchedIndicators = rule.folderIndicators.filter(
        indicator => folderNames.has(indicator.toLowerCase())
      );

      if (matchedIndicators.length < rule.minFolderMatches) continue;

      const extra = matchedIndicators.length - rule.minFolderMatches;
      let confidence = rule.baseConfidence + extra * rule.confidencePerExtra;

      if (rule.name === 'Microservice Architecture' && structure.projects && structure.projects.length >= 3) {
        confidence = Math.min(1.0, confidence + 0.15);
      }

      confidence = Math.min(0.97, confidence);

      results.push({
        name: rule.name,
        confidence: Math.round(confidence * 100) / 100,
        indicators: matchedIndicators,
      });
    }

    return results;
  }

  collectFolderNames(structure) {
    const names = new Set();
    if (structure?.root) {
      this.walkFolder(structure.root, names);
    }
    return names;
  }

  walkFolder(folder, accumulator) {
    if (folder.name) {
      accumulator.add(folder.name.toLowerCase());
    }
    for (const child of (folder.children ?? [])) {
      this.walkFolder(child, accumulator);
    }
  }
}

module.exports = { ArchitectureDetectorEngine };
