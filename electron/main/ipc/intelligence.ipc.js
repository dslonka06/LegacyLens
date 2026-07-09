const { ipcMain } = require('electron');
const { wrapHandler } = require('./ipc-utils');
const { AnalysisEngine } = require('../engines/analysis/analysis.engine');
const { ArchitectureDetectorEngine } = require('../engines/architecture/architecture-detector.engine');
const { DependencyExplorerEngine } = require('../engines/knowledge/dependency-explorer.engine');
const { DependencyMapperEngine } = require('../engines/knowledge/dependency-mapper.engine');
const { TechnologyDetectorEngine } = require('../engines/knowledge/technology-detector.engine');
const { ProjectDiscoveryEngine } = require('../engines/knowledge/project-discovery.engine');
const { RepositoryScannerEngine } = require('../engines/knowledge/repository-scanner.engine');
const { WorkspaceClassifierEngine } = require('../engines/knowledge/workspace-classifier.engine');
const { SystemUnderstandingEngine } = require('../engines/analysis/system-understanding.engine');
const { WorkflowExplorerEngine } = require('../engines/analysis/workflow-explorer.engine');
const { LearningPathAnalysisEngine } = require('../engines/analysis/learning-path-analysis.engine');
const { DataFlowDiscoveryEngine } = require('../engines/analysis/data-flow-discovery.engine');
const { RecommendationAnalysisEngine } = require('../engines/analysis/recommendation-analysis.engine');
const { SecurityAnalysisEngine } = require('../engines/analysis/security-analysis.engine');
const { RepositoryInsightsEngine } = require('../engines/analysis/repository-insights.engine');
const { RepositorySummaryEngine } = require('../engines/analysis/repository-summary.engine');
const { CapabilityPipelineEngine, CAPABILITY_MAP } = require('../engines/core/capability-pipeline.engine');
const { KnowledgeModelEngine } = require('../engines/core/knowledge-model.engine');
const { KnowledgeModelService } = require('../services/knowledge/knowledge-model.service');
const { ContextGenerationEngine } = require('../engines/core/context-generation.engine');
const { IncrementalUpdateEngine } = require('../engines/core/incremental-update.engine');
const { KnowledgeService } = require('../services/knowledge/knowledge.service');

const analysisEngine = new AnalysisEngine();
const capabilityPipeline = new CapabilityPipelineEngine();
const knowledgeModelEngine = new KnowledgeModelEngine();
const knowledgeModelService = new KnowledgeModelService();
const contextEngine = new ContextGenerationEngine();
const incrementalEngine = new IncrementalUpdateEngine();
const knowledgeService = new KnowledgeService();
const architectureDetector = new ArchitectureDetectorEngine();
const dependencyExplorer = new DependencyExplorerEngine();
const dependencyMapper = new DependencyMapperEngine();
const technologyDetector = new TechnologyDetectorEngine();
const projectDiscovery = new ProjectDiscoveryEngine();
const repositoryScanner = new RepositoryScannerEngine();
const workspaceClassifier = new WorkspaceClassifierEngine();
const systemUnderstanding = new SystemUnderstandingEngine();
const workflowExplorer = new WorkflowExplorerEngine();
const learningPath = new LearningPathAnalysisEngine();
const dataFlowDiscovery = new DataFlowDiscoveryEngine();
const recommendations = new RecommendationAnalysisEngine();
const securityAnalysis = new SecurityAnalysisEngine();
const repositoryInsights = new RepositoryInsightsEngine();
const repositorySummary = new RepositorySummaryEngine();

/**
 * Adapts the new KnowledgeModel contract shape to the legacy {knowledge, session}
 * parameters that the AI analysis engines currently expect.
 *
 * This is a translation layer — the engines themselves are unchanged.
 * File-scope models produce a session-shaped object and null knowledge.
 * Folder/repository models produce a knowledge-shaped object and null session.
 *
 * Remove this adapter once the engines are rewritten to accept KnowledgeModel directly.
 */
function adaptModelForEngines(model) {
  const isFile = model.targetType === 'file';

  if (isFile) {
    const s = model.structure ?? {};
    const ins = model.insights ?? {};
    const session = {
      fileName:   s.filePath    ?? 'unknown',
      sourceCode: s.sourceCode  ?? '',
      analysis: {
        language:              s.fileLanguage ?? s.languages?.[0] ?? 'Unknown',
        type:                  'file',
        summary:               '',
        risks:                 (ins.risks ?? []).map(r => r.description),
        responsibilities:      [],
        dependencies:          [],
        architectureLayers:    [],
        patterns:              [],
        modernizationSuggestions: [],
        dataFlow:              ins.dataFlow?.steps?.join(' → ') ?? '',
        inputs:                ins.dataFlow?.inputs  ?? [],
        outputs:               ins.dataFlow?.outputs ?? [],
        architecture:          '',
        complexity:            ins.complexity      ?? 'Low',
        maintainability:       ins.maintainability ?? 'High',
      },
      aiAnalysis: model.ai ? {
        summary:         model.ai.understanding?.executiveSummary ?? '',
        businessPurpose: model.ai.understanding?.businessPurpose  ?? '',
        risks:           (model.ai.security?.findings ?? []).map(f => ({
          title:       f.title,
          description: f.issueDescription,
          severity:    f.severity,
        })),
        modernizations: (model.ai.recommendations?.recommendations ?? []).slice(0, 5).map(r => ({
          title:       r.title,
          description: r.recommendedImprovement,
        })),
      } : undefined,
    };
    return { session, knowledge: null };
  }

  // folder / repository — translate new shape to old RepositoryKnowledge shape
  const rel = model.relationships ?? {};
  const knowledge = {
    sourceFiles:     [],
    dependencyGraph: rel.dependencies?.graph  ?? null,
    architecture:    rel.architecture         ? { patterns: rel.architecture.patterns } : null,
    builtAt:         model.metadata?.builtAt  ?? new Date().toISOString(),
  };

  const session = model.ai ? {
    aiAnalysis: {
      summary:         model.ai.understanding?.executiveSummary ?? '',
      businessPurpose: model.ai.understanding?.businessPurpose  ?? '',
      risks:           (model.ai.security?.findings ?? []).map(f => ({
        title:       f.title,
        description: f.issueDescription,
        severity:    f.severity,
      })),
      modernizations: (model.ai.recommendations?.recommendations ?? []).slice(0, 5).map(r => ({
        title:       r.title,
        description: r.recommendedImprovement,
      })),
    },
  } : null;

  return { knowledge, session };
}

function registerIntelligenceHandlers() {
  // intelligence:analyzeCode — analyze a single source file string
  ipcMain.handle('intelligence:analyzeCode', wrapHandler(async (_event, code) => {
    if (!code || typeof code !== 'string') throw new Error('code is required');
    return analysisEngine.analyze(code);
  }));

  // intelligence:detectArchitecture — detect architecture from file structure + dependency graph
  ipcMain.handle('intelligence:detectArchitecture', wrapHandler(async (_event, structure, graph) => {
    return architectureDetector.detect(structure, graph);
  }));

  // intelligence:buildDependencyGraph — build a dependency graph from source files
  ipcMain.handle('intelligence:buildDependencyGraph', wrapHandler(async (_event, sourceFiles) => {
    return dependencyMapper.buildGraph(sourceFiles);
  }));

  // intelligence:exploreDependencies — derive hubs, orphans, and ranked connectivity from a graph
  ipcMain.handle('intelligence:exploreDependencies', wrapHandler(async (_event, graph) => {
    return {
      hubs: dependencyExplorer.dependencyHubs(graph),
      orphans: dependencyExplorer.orphanedFiles(graph),
      ranked: dependencyExplorer.rankByConnectivity(graph),
    };
  }));

  // intelligence:detectTechnologies — identify technologies used across a file set
  ipcMain.handle('intelligence:detectTechnologies', wrapHandler(async (_event, files) => {
    return technologyDetector.detect(files);
  }));

  // intelligence:discoverProjects — find sub-projects within a file set
  ipcMain.handle('intelligence:discoverProjects', wrapHandler(async (_event, files) => {
    return projectDiscovery.discoverProjects(files);
  }));

  // intelligence:scanRepository — full repository scan producing structured metadata
  ipcMain.handle('intelligence:scanRepository', wrapHandler(async (_event, files) => {
    return repositoryScanner.scan(files);
  }));

  // intelligence:classifyWorkspace — classify workspace type from a file set
  ipcMain.handle('intelligence:classifyWorkspace', wrapHandler(async (_event, files) => {
    return workspaceClassifier.classify(files);
  }));

  // intelligence:systemUnderstanding — accepts KnowledgeModel, adapts to engine's expected shape
  ipcMain.handle('intelligence:systemUnderstanding', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    const { knowledge, session } = adaptModelForEngines(model);
    return knowledge
      ? systemUnderstanding.analyzeKnowledge(knowledge, session)
      : systemUnderstanding.analyzeFile(session);
  }));

  // intelligence:exploreWorkflows — build summaries from discovered workflow flows
  ipcMain.handle('intelligence:exploreWorkflows', wrapHandler(async (_event, flows) => {
    return workflowExplorer.buildSummaries(flows);
  }));

  // intelligence:learningPath — accepts KnowledgeModel; understanding read from model.ai
  ipcMain.handle('intelligence:learningPath', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    const { knowledge, session } = adaptModelForEngines(model);
    const understanding = model.ai?.understanding ?? null;
    const scope = model.targetType ?? 'repository';
    return knowledge
      ? learningPath.analyzeKnowledge(knowledge, session, understanding, scope)
      : learningPath.analyzeFile(session, understanding);
  }));

  // intelligence:discoverDataFlows — discover data/workflow flows from knowledge + structure
  ipcMain.handle('intelligence:discoverDataFlows', wrapHandler(async (_event, knowledge, structure) => {
    return dataFlowDiscovery.discoverWorkflows(knowledge, structure);
  }));

  // intelligence:recommendations — accepts KnowledgeModel, adapts to engine's expected shape
  ipcMain.handle('intelligence:recommendations', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    const { knowledge, session } = adaptModelForEngines(model);
    return knowledge
      ? recommendations.analyzeKnowledge(knowledge, session)
      : recommendations.analyzeFile(session);
  }));

  // intelligence:security — accepts KnowledgeModel, adapts to engine's expected shape
  ipcMain.handle('intelligence:security', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    const { knowledge, session } = adaptModelForEngines(model);
    return knowledge
      ? securityAnalysis.analyzeKnowledge(knowledge, session)
      : securityAnalysis.analyzeFile(session);
  }));

  // intelligence:insights — derive repository-level insights from aggregated knowledge
  ipcMain.handle('intelligence:insights', wrapHandler(async (_event, knowledge) => {
    return repositoryInsights.analyze(knowledge);
  }));

  // intelligence:buildSummary — build a workspace summary from context, knowledge, and session
  ipcMain.handle('intelligence:buildSummary', wrapHandler(async (_event, workspaceContext, knowledge, session) => {
    return repositorySummary.build(workspaceContext, knowledge, session);
  }));

  // intelligence:runPipeline — D2/D3: run capability pipeline for a validated target
  ipcMain.handle('intelligence:runPipeline', wrapHandler(async (_event, targetType, files) => {
    if (!targetType || !['file', 'folder', 'repository'].includes(targetType)) {
      throw new Error('targetType must be one of: file, folder, repository');
    }
    if (!Array.isArray(files)) throw new Error('files must be an array');
    return capabilityPipeline.run(targetType, files);
  }));

  // intelligence:capabilitiesFor — return which capabilities will run for a target type
  ipcMain.handle('intelligence:capabilitiesFor', wrapHandler(async (_event, targetType) => {
    return capabilityPipeline.capabilitiesFor(targetType);
  }));

  // intelligence:buildKnowledgeModel — D4: run pipeline + build + optionally persist KnowledgeModel
  // options: { repositoryPath?, workspaceName?, repositoryId?, persist? }
  ipcMain.handle('intelligence:buildKnowledgeModel', wrapHandler(async (_event, targetType, files, options) => {
    if (!targetType || !['file', 'folder', 'repository'].includes(targetType)) {
      throw new Error('targetType must be one of: file, folder, repository');
    }
    if (!Array.isArray(files)) throw new Error('files must be an array');

    const opts = options ?? {};
    const pipelineResult = capabilityPipeline.run(targetType, files);
    const model = knowledgeModelEngine.build(pipelineResult, {
      repositoryPath: opts.repositoryPath ?? null,
      workspaceName: opts.workspaceName ?? null,
    });

    if (opts.persist && opts.repositoryId) {
      const analysisId = knowledgeModelService.save(opts.repositoryId, model);
      model._analysisId = analysisId;
    }

    return model;
  }));

  // intelligence:getKnowledgeModel — D4: retrieve persisted KnowledgeModel for a repository
  ipcMain.handle('intelligence:getKnowledgeModel', wrapHandler(async (_event, repositoryId) => {
    if (!repositoryId) throw new Error('repositoryId is required');
    return knowledgeModelService.getLatest(repositoryId);
  }));

  // intelligence:buildContext — D5: generate feature-specific context from a KnowledgeModel
  // contextType: 'repository' | 'workflow' | 'security' | 'analysis'
  // extras: feature-specific supplemental data (workflow, securityAnalysis, scope, workspaceName)
  ipcMain.handle('intelligence:buildContext', wrapHandler(async (_event, contextType, knowledgeModel, extras) => {
    if (!contextType) throw new Error('contextType is required');
    if (!knowledgeModel) throw new Error('knowledgeModel is required');
    return contextEngine.build(contextType, knowledgeModel, extras ?? {});
  }));

  // intelligence:checkIncremental — D6: check whether a rebuild is needed for a repository
  // currentFiles: Array<{ relativePath, hash }>
  // Returns: { needsFullRebuild, needsPartialRebuild, changedPaths, reason, existingModel }
  ipcMain.handle('intelligence:checkIncremental', wrapHandler(async (_event, repositoryId, currentFiles, targetType) => {
    if (!repositoryId) throw new Error('repositoryId is required');
    if (!Array.isArray(currentFiles)) throw new Error('currentFiles must be an array');
    const requiredCapabilities = CAPABILITY_MAP[targetType] ?? [];
    return incrementalEngine.check(repositoryId, currentFiles, requiredCapabilities);
  }));

  // intelligence:processWorkspace — D7: unified entry point for all workspace analysis
  // Chains: D6 incremental check → D2/D3 pipeline (if needed) → D4 model build → persist
  // request: { targetType, files, options: { repositoryId?, repositoryPath?, workspaceName?, persist?, incremental? } }
  ipcMain.handle('intelligence:processWorkspace', wrapHandler(async (_event, request) => {
    if (!request) throw new Error('request is required');
    if (!request.targetType || !['file', 'folder', 'repository'].includes(request.targetType)) {
      throw new Error('targetType must be one of: file, folder, repository');
    }
    if (!Array.isArray(request.files)) throw new Error('files must be an array');
    return knowledgeService.process(request);
  }));
}

module.exports = { registerIntelligenceHandlers };
