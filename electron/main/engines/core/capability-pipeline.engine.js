'use strict';

const { PatternParser } = require('./pattern-parser');
const { TechnologyDetectorEngine } = require('../knowledge/technology-detector.engine');
const { DependencyMapperEngine } = require('../knowledge/dependency-mapper.engine');
const { DependencyExplorerEngine } = require('../knowledge/dependency-explorer.engine');
const { RepositoryScannerEngine } = require('../knowledge/repository-scanner.engine');
const { ProjectDiscoveryEngine } = require('../knowledge/project-discovery.engine');
const { WorkspaceClassifierEngine } = require('../knowledge/workspace-classifier.engine');

// Capability identifiers — used to label results and select execution order.
const CAPABILITIES = {
  FILE_PARSING:          'fileParsing',
  LANGUAGE_DETECTION:    'languageDetection',
  SYMBOL_EXTRACTION:     'symbolExtraction',
  FOLDER_STRUCTURE:      'folderStructure',
  FRAMEWORK_DETECTION:   'frameworkDetection',
  DEPENDENCY_RESOLUTION: 'dependencyResolution',
  MULTI_PROJECT:         'multiProject',
  GIT_ANALYSIS:          'gitAnalysis',
  ARCHITECTURE:          'architectureDiscovery',
};

// Which capabilities apply to each target type.
// Ordered by execution dependency: parsing before dependency resolution, structure before architecture.
const CAPABILITY_MAP = {
  file: [
    CAPABILITIES.FILE_PARSING,
    CAPABILITIES.LANGUAGE_DETECTION,
    CAPABILITIES.SYMBOL_EXTRACTION,
  ],
  folder: [
    CAPABILITIES.FILE_PARSING,
    CAPABILITIES.LANGUAGE_DETECTION,
    CAPABILITIES.SYMBOL_EXTRACTION,
    CAPABILITIES.FOLDER_STRUCTURE,
    CAPABILITIES.FRAMEWORK_DETECTION,
    CAPABILITIES.DEPENDENCY_RESOLUTION,
  ],
  repository: [
    CAPABILITIES.FILE_PARSING,
    CAPABILITIES.LANGUAGE_DETECTION,
    CAPABILITIES.SYMBOL_EXTRACTION,
    CAPABILITIES.FOLDER_STRUCTURE,
    CAPABILITIES.FRAMEWORK_DETECTION,
    CAPABILITIES.DEPENDENCY_RESOLUTION,
    CAPABILITIES.MULTI_PROJECT,
    CAPABILITIES.GIT_ANALYSIS,
    CAPABILITIES.ARCHITECTURE,
  ],
};

class CapabilityPipelineEngine {

  constructor() {
    this.parser              = new PatternParser();
    this.technologyDetector  = new TechnologyDetectorEngine();
    this.dependencyMapper    = new DependencyMapperEngine();
    this.dependencyExplorer  = new DependencyExplorerEngine();
    this.repositoryScanner   = new RepositoryScannerEngine();
    this.projectDiscovery    = new ProjectDiscoveryEngine();
    this.workspaceClassifier = new WorkspaceClassifierEngine();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run the full capability pipeline for the given target type.
   *
   * @param {'file'|'folder'|'repository'} targetType  Validated target from D1
   * @param {Array<{name,path,extension,content}>} files  Source files
   * @returns {PipelineResult}
   */
  run(targetType, files) {
    const capabilities = CAPABILITY_MAP[targetType] ?? CAPABILITY_MAP.file;
    const result = this.emptyResult(targetType, capabilities);

    for (const cap of capabilities) {
      try {
        this.executeCapability(cap, files, result);
        result.executedCapabilities.push(cap);
      } catch (err) {
        result.capabilityErrors[cap] = err.message;
      }
    }

    return result;
  }

  /**
   * Return which capabilities will be activated for a given target type,
   * without running them. Useful for pre-flight checks or UI hints.
   */
  capabilitiesFor(targetType) {
    return CAPABILITY_MAP[targetType] ?? CAPABILITY_MAP.file;
  }

  // ── Capability executors ───────────────────────────────────────────────────

  executeCapability(capability, files, result) {
    switch (capability) {

      case CAPABILITIES.FILE_PARSING:
        result.parsedFiles = files
          .filter(f => f.content !== null && f.content !== undefined)
          .map(f => this.parser.parse(f));
        break;

      case CAPABILITIES.LANGUAGE_DETECTION: {
        // Aggregate language counts from parsed files.
        const counts = {};
        for (const pf of result.parsedFiles) {
          if (pf.language && pf.language !== 'Unknown') {
            counts[pf.language] = (counts[pf.language] ?? 0) + 1;
          }
        }
        result.languages = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([lang]) => lang);

        // Full technology detection via existing engine (includes framework signals).
        result.detectedTechnologies = this.technologyDetector.detect(files);
        break;
      }

      case CAPABILITIES.SYMBOL_EXTRACTION:
        // Symbols are already in parsedFiles; surface a flat index for easy lookup.
        result.symbolIndex = this.buildSymbolIndex(result.parsedFiles);
        break;

      case CAPABILITIES.FOLDER_STRUCTURE:
        result.folderStructure = this.repositoryScanner.scan(files);
        break;

      case CAPABILITIES.FRAMEWORK_DETECTION:
        // detectedTechnologies already populated by LANGUAGE_DETECTION.
        result.frameworks = (result.detectedTechnologies ?? [])
          .filter(t => t.category === 'Framework' || t.category === 'Runtime')
          .map(t => t.name ?? t.technology);
        break;

      case CAPABILITIES.DEPENDENCY_RESOLUTION:
        result.dependencyGraph = this.dependencyMapper.buildGraph(files);
        result.dependencyHubs  = this.dependencyExplorer.dependencyHubs(result.dependencyGraph);
        result.dependencyRanks = this.dependencyExplorer.rankByConnectivity(result.dependencyGraph);
        break;

      case CAPABILITIES.MULTI_PROJECT:
        result.projects = this.projectDiscovery.discoverProjects(files);
        break;

      case CAPABILITIES.GIT_ANALYSIS:
        // Git metadata is not yet available in the in-process engine.
        // This capability is a registered stub — it records its presence in
        // executedCapabilities so D4 Knowledge Model can include a gitAnalysis
        // section, even if the data is currently empty.
        result.gitAnalysis = { available: false, reason: 'Git analysis deferred to D6' };
        break;

      case CAPABILITIES.ARCHITECTURE:
        // Architecture discovery requires a full dependency graph (built in
        // DEPENDENCY_RESOLUTION). Run only when the graph is available.
        if (result.dependencyGraph) {
          result.architectureHints = this.deriveArchitectureHints(
            result.folderStructure,
            result.dependencyGraph,
            result.detectedTechnologies ?? [],
          );
        }
        break;

      default:
        throw new Error(`Unknown capability: ${capability}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  emptyResult(targetType, capabilities) {
    return {
      targetType,
      plannedCapabilities: capabilities,
      executedCapabilities: [],
      capabilityErrors: {},
      parsedFiles: [],
      languages: [],
      detectedTechnologies: [],
      frameworks: [],
      symbolIndex: {},
      folderStructure: null,
      dependencyGraph: null,
      dependencyHubs: [],
      dependencyRanks: [],
      projects: [],
      gitAnalysis: null,
      architectureHints: null,
    };
  }

  buildSymbolIndex(parsedFiles) {
    const index = {};
    for (const pf of parsedFiles) {
      index[pf.path] = {
        classes: pf.classes,
        methods: pf.methods,
        imports: pf.imports,
        exports: pf.exports,
        language: pf.language,
        type: pf.type,
      };
    }
    return index;
  }

  deriveArchitectureHints(structure, graph, technologies) {
    const hints = [];

    // Layer detection: look for conventional folder names
    if (structure?.root?.children) {
      const folderNames = structure.root.children.map(c => c.name.toLowerCase());
      if (folderNames.some(n => ['controllers', 'controller'].includes(n))) hints.push('MVC Controllers detected');
      if (folderNames.some(n => ['services', 'service'].includes(n))) hints.push('Service layer detected');
      if (folderNames.some(n => ['repositories', 'repository', 'data', 'dal'].includes(n))) hints.push('Repository/data layer detected');
      if (folderNames.some(n => ['models', 'entities', 'domain'].includes(n))) hints.push('Domain/model layer detected');
      if (folderNames.some(n => ['components', 'pages', 'views'].includes(n))) hints.push('UI component layer detected');
    }

    // Connectivity-based hub detection
    const hubCount = graph.nodes
      ? graph.nodes.filter(n => {
          const inbound = graph.edges.filter(e => e.target === n.id).length;
          return inbound >= 5;
        }).length
      : 0;
    if (hubCount > 0) hints.push(`${hubCount} high-connectivity hub file(s) detected`);

    // Technology signals
    const techNames = technologies.map(t => (t.name ?? t.technology ?? '').toLowerCase());
    if (techNames.some(t => t.includes('angular'))) hints.push('Angular frontend architecture');
    if (techNames.some(t => t.includes('aspnet') || t.includes('asp.net'))) hints.push('ASP.NET backend architecture');
    if (techNames.some(t => t.includes('react'))) hints.push('React frontend architecture');

    return hints;
  }
}

module.exports = { CapabilityPipelineEngine, CAPABILITIES, CAPABILITY_MAP };
