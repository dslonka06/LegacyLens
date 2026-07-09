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
const { CapabilityPipelineEngine } = require('../engines/core/capability-pipeline.engine');
const { KnowledgeModelEngine } = require('../engines/core/knowledge-model.engine');
const { KnowledgeModelService } = require('../services/knowledge/knowledge-model.service');

const analysisEngine = new AnalysisEngine();
const capabilityPipeline = new CapabilityPipelineEngine();
const knowledgeModelEngine = new KnowledgeModelEngine();
const knowledgeModelService = new KnowledgeModelService();
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

  // intelligence:systemUnderstanding — file mode when no knowledge, knowledge mode otherwise
  ipcMain.handle('intelligence:systemUnderstanding', wrapHandler(async (_event, session, knowledge) => {
    return knowledge
      ? systemUnderstanding.analyzeKnowledge(knowledge, session)
      : systemUnderstanding.analyzeFile(session);
  }));

  // intelligence:exploreWorkflows — build summaries from discovered workflow flows
  ipcMain.handle('intelligence:exploreWorkflows', wrapHandler(async (_event, flows) => {
    return workflowExplorer.buildSummaries(flows);
  }));

  // intelligence:learningPath — file mode when no knowledge, knowledge mode otherwise
  ipcMain.handle('intelligence:learningPath', wrapHandler(async (_event, session, knowledge, understanding, scope) => {
    return knowledge
      ? learningPath.analyzeKnowledge(knowledge, session, understanding, scope)
      : learningPath.analyzeFile(session, understanding);
  }));

  // intelligence:discoverDataFlows — discover data/workflow flows from knowledge + structure
  ipcMain.handle('intelligence:discoverDataFlows', wrapHandler(async (_event, knowledge, structure) => {
    return dataFlowDiscovery.discoverWorkflows(knowledge, structure);
  }));

  // intelligence:recommendations — file mode when no knowledge, knowledge mode otherwise
  ipcMain.handle('intelligence:recommendations', wrapHandler(async (_event, session, knowledge) => {
    return knowledge
      ? recommendations.analyzeKnowledge(knowledge, session)
      : recommendations.analyzeFile(session);
  }));

  // intelligence:security — file mode when no knowledge, knowledge mode otherwise
  ipcMain.handle('intelligence:security', wrapHandler(async (_event, session, knowledge) => {
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
}

module.exports = { registerIntelligenceHandlers };
