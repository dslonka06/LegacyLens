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
const { HubNarrativeEngine } = require('../engines/narrative/hub-narrative.engine');
const { BusinessPurposeNarrativeEngine } = require('../engines/narrative/business-purpose-narrative.engine');
const { CodeHealthNarrativeEngine } = require('../engines/narrative/code-health-narrative.engine');
const { ResponsibilitiesNarrativeEngine } = require('../engines/narrative/responsibilities-narrative.engine');
const { FolderResponsibilitiesNarrativeEngine } = require('../engines/narrative/folder-responsibilities-narrative.engine');
const { FolderWorkflowsNarrativeEngine } = require('../engines/narrative/folder-workflows-narrative.engine');
const { DebtHotspotNarrativeEngine } = require('../engines/narrative/debt-hotspot-narrative.engine');
const { ReadingOrderNarrativeEngine } = require('../engines/narrative/reading-order-narrative.engine');
const { LayerBreakdownNarrativeEngine } = require('../engines/narrative/layer-breakdown-narrative.engine');
const { FileRoleNarrativeEngine } = require('../engines/narrative/file-role-narrative.engine');
const { DataFlowPatternEngine } = require('../engines/narrative/data-flow-pattern.engine');
const { DataFlowStepsNarrativeEngine } = require('../engines/narrative/data-flow-steps-narrative.engine');
const { WorkflowExplorerEngine } = require('../engines/analysis/workflow-explorer.engine');
const { LearningConceptEngine } = require('../engines/narrative/learning-concept.engine');
const { DataFlowDiscoveryEngine } = require('../engines/analysis/data-flow-discovery.engine');
const { RecommendationAnalysisEngine } = require('../engines/analysis/recommendation-analysis.engine');
const { SecurityEvidenceEngine } = require('../engines/security/security-evidence.engine');
const fs = require('fs');
const nodePath = require('path');
const { ArchitectureAnalysisEngine } = require('../engines/analysis/architecture-analysis.engine');
const { DataFlowAnalysisEngine } = require('../engines/analysis/data-flow-analysis.engine');
const { RepositoryInsightsEngine } = require('../engines/analysis/repository-insights.engine');
const { RepositorySummaryEngine } = require('../engines/analysis/repository-summary.engine');
const { ArchitectureDiagramEngine } = require('../engines/diagram/architecture-diagram.engine');
const { DataFlowDiagramEngine } = require('../engines/diagram/data-flow-diagram.engine');
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
const hubNarrative = new HubNarrativeEngine();
const businessPurposeNarrative = new BusinessPurposeNarrativeEngine();
const codeHealthNarrative = new CodeHealthNarrativeEngine();
const responsibilitiesNarrative = new ResponsibilitiesNarrativeEngine();
const folderResponsibilitiesNarrative = new FolderResponsibilitiesNarrativeEngine();
const folderWorkflowsNarrative = new FolderWorkflowsNarrativeEngine();
const debtHotspotNarrative = new DebtHotspotNarrativeEngine();
const readingOrderNarrative = new ReadingOrderNarrativeEngine();
const layerBreakdownNarrative = new LayerBreakdownNarrativeEngine();
const fileRoleNarrative = new FileRoleNarrativeEngine();
const dataFlowPattern = new DataFlowPatternEngine();
const dataFlowStepsNarrative = new DataFlowStepsNarrativeEngine();
const workflowExplorer = new WorkflowExplorerEngine();
const learningConcept = new LearningConceptEngine();
const dataFlowDiscovery = new DataFlowDiscoveryEngine();
const recommendations = new RecommendationAnalysisEngine();
const securityEvidence = new SecurityEvidenceEngine();
const architectureAnalysis = new ArchitectureAnalysisEngine();
const dataFlowAnalysis = new DataFlowAnalysisEngine();
const repositoryInsights = new RepositoryInsightsEngine();
const repositorySummary = new RepositorySummaryEngine();
const architectureDiagram = new ArchitectureDiagramEngine();
const dataFlowDiagram = new DataFlowDiagramEngine();

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
        responsibilities:      ins.responsibilities ?? model.ai?.understanding?.keyResponsibilities ?? [],
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
    };
    return { session, knowledge: null };
  }

  // folder / repository — translate new shape to old RepositoryKnowledge shape
  const rel = model.relationships ?? {};
  const str = model.structure ?? {};
  const symbols = str.symbols ?? {};
  const knowledge = {
    sourceFiles:     Object.keys(symbols).map(path => ({
      path,
      extension: path.split('.').pop() ?? '',
      content:   '',
    })),
    frameworks:      str.frameworks  ?? [],
    technologies:    (str.technologies ?? []).map(t => t.name ?? t),
    dependencyGraph: rel.dependencies?.graph  ?? null,
    architecture:    rel.architecture         ? { patterns: rel.architecture.patterns } : null,
    builtAt:         model.metadata?.builtAt  ?? new Date().toISOString(),
  };

  const session = null;

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
    console.log('[IPC] intelligence:systemUnderstanding targetType=' + model.targetType);
    const { knowledge, session } = adaptModelForEngines(model);
    const understanding = await (knowledge
      ? systemUnderstanding.analyzeKnowledge(knowledge, session, model.targetType)
      : systemUnderstanding.analyzeFile(session));
    console.log('[IPC] intelligence:systemUnderstanding done result=' + (understanding ? 'ok' : 'null'));

    // Build structural hub narrative pass (pass 2 directive is appended by a later stage)
    const ins = model.insights ?? {};
    const rel = model.relationships ?? {};
    const graph = rel.dependencies?.graph ?? null;
    const isFile = model.targetType === 'file';
    const symbols = model.structure?.symbols ?? {};

    const inboundMap = new Map();
    const outboundMap = new Map();
    if (graph) {
      for (const e of graph.edges ?? []) {
        inboundMap.set(e.target, (inboundMap.get(e.target) ?? 0) + 1);
        outboundMap.set(e.source, (outboundMap.get(e.source) ?? 0) + 1);
      }
    }

    const narrativeData = {
      scope:               model.targetType,
      fileName:            model.structure?.filePath?.split(/[\\/]/).pop() ?? model.workspaceName ?? 'this',
      inboundDeps:         isFile
                             ? (ins.dataFlow?.inputs?.length ?? 0)
                             : (graph?.nodes?.reduce((max, n) => Math.max(max, inboundMap.get(n.id) ?? 0), 0) ?? 0),
      outboundDeps:        isFile
                             ? (ins.dataFlow?.outputs?.length ?? 0)
                             : (graph?.edges?.length ?? 0),
      complexity:          ins.complexity ?? understanding?.health?.complexity ?? 'Medium',
      maintainability:     ins.maintainability ?? understanding?.health?.maintainability ?? 'Medium',
      riskCount:           (ins.risks ?? []).length,
      symbolCount:         Object.keys(symbols).length,
      flowSteps:           ins.dataFlow?.steps?.length ?? 0,
      fileCount:           Object.keys(symbols).length,
      couplingRatio:       graph && graph.nodes?.length > 0
                             ? (graph.edges?.length ?? 0) / graph.nodes.length
                             : 0,
      architecturePatterns: (rel.architecture?.patterns ?? []).map(p => p.name),
    };

    const structural = hubNarrative.buildStructural(narrativeData);

    const purposeData = {
      scope:                     narrativeData.scope,
      name:                      narrativeData.fileName,
      businessCriticality:       understanding?.businessCriticality ?? 'Medium',
      businessCriticalityReason: understanding?.businessCriticalityReason ?? '',
      responsibilityCount:       (understanding?.responsibilityGroups ?? []).length,
      capabilityCount:           (understanding?.coreCapabilities ?? []).length,
      complexity:                narrativeData.complexity,
      maintainability:           narrativeData.maintainability,
      riskCount:                 narrativeData.riskCount,
    };

    const healthData = {
      scope:           narrativeData.scope,
      name:            narrativeData.fileName,
      complexity:      narrativeData.complexity,
      maintainability: narrativeData.maintainability,
      riskCount:       narrativeData.riskCount,
      fileCount:       narrativeData.fileCount,
    };

    // ── File-scope narrative engines ─────────────────────────────────────────
    let fileResponsibilitiesNarrativeResult = null;
    let fileComponentsNarrative = null;

    // ── Folder-scope narrative engines ────────────────────────────────────────
    let folderResponsibilitiesNarrativeResult = null;
    let folderWorkflowsNarrativeResult = null;

    if (!isFile && model.targetType === 'folder') {
      const ins = model.insights ?? {};
      const rel = model.relationships ?? {};
      const graphNodes = rel.dependencies?.graph?.nodes ?? [];
      const graphEdges = rel.dependencies?.graph?.edges ?? [];
      const folderFileCount = Object.keys(model.structure?.symbols ?? {}).length;
      const couplingRatio = graphNodes.length > 0 ? graphEdges.length / graphNodes.length : 0;
      const architecturePatterns = (rel.architecture?.patterns ?? []).map(p => p.name);

      folderResponsibilitiesNarrativeResult = folderResponsibilitiesNarrative.build({
        responsibilities:     understanding?.keyResponsibilities ?? [],
        responsibilityGroups: understanding?.responsibilityGroups ?? [],
        complexity:           ins.complexity      ?? 'Medium',
        maintainability:      ins.maintainability ?? 'Medium',
        fileCount:            folderFileCount,
      });

      folderWorkflowsNarrativeResult = folderWorkflowsNarrative.build({
        workflows:            understanding?.keyWorkflows ?? [],
        architecturePatterns,
        fileCount:            folderFileCount,
        couplingRatio,
      });
    }

    if (isFile) {
      const s        = model.structure ?? {};
      const filePath = s.filePath ?? '';
      const symbolEntry = s.symbols?.[filePath] ?? Object.values(s.symbols ?? {})[0] ?? {};

      const respData = {
        responsibilities: ins.responsibilities ?? understanding?.keyResponsibilities ?? [],
        language:         s.fileLanguage ?? s.languages?.[0] ?? 'Unknown',
        fileType:         symbolEntry.type ?? 'file',
        complexity:       ins.complexity      ?? 'Medium',
        maintainability:  ins.maintainability ?? 'Medium',
        inputs:           ins.dataFlow?.inputs  ?? [],
        outputs:          ins.dataFlow?.outputs ?? [],
        flowSteps:        ins.dataFlow?.steps   ?? [],
        risks:            ins.risks ?? [],
      };
      fileResponsibilitiesNarrativeResult = responsibilitiesNarrative.build(respData);

      fileComponentsNarrative = {
        items: [
          ...(symbolEntry.classes ?? []).map(name => ({ name, kind: 'class' })),
          ...(symbolEntry.methods ?? []).map(name => ({ name, kind: 'method' })),
        ],
        imports: symbolEntry.imports ?? [],
        exports: symbolEntry.exports ?? [],
      };
    }

    const debtHotspotsNarrativeResult = (model.targetType === 'repository' && understanding?.technicalDebtHotspots?.length)
      ? debtHotspotNarrative.buildAll(
          understanding.technicalDebtHotspots,
          model.relationships?.dependencies?.graph?.nodes?.length ?? 0,
        )
      : null;

    // ── Reading Order (folder + repo scope) ──────────────────────────────────
    // Rank files by total degree (inbound + outbound), exclude any that already
    // appear in the learning path's suggestedReadingOrder so the two panels
    // surface different files.
    let readingOrderNarrativeResult = null;
    const isMultiFile = !isFile;
    if (isMultiFile) {
      const ranks = model.relationships?.dependencies?.ranks ?? [];
      const dataFlowFacts = model.relationships?.dataFlowFacts ?? [];
      const symbols = model.structure?.symbols ?? {};
      const totalFiles = Object.keys(symbols).length || ranks.length;

      // Build a Set of paths already covered by the learning path reading order
      const learningPathPaths = new Set(
        (model.ai?.learningPath?.suggestedReadingOrder ?? [])
          .map(item => item.path)
          .filter(Boolean)
      );

      // Build a role lookup from dataFlowFacts (path → fileRole)
      const roleByPath = {};
      for (const fact of dataFlowFacts) {
        if (fact.path) roleByPath[fact.path] = fact.fileRole ?? 'unknown';
      }

      const candidates = ranks
        .filter(r => r.node?.path && !learningPathPaths.has(r.node.path))
        .slice(0, 8);

      if (candidates.length > 0) {
        const graph = model.relationships?.dependencies?.graph ?? null;
        const nodeNameById = graph ? new Map(graph.nodes.map(n => [n.id, n.name])) : new Map();

        // Build caller/callee lookup from graph edges
        const callersByPath = {};
        const calleesByPath = {};
        if (graph?.edges) {
          for (const edge of graph.edges) {
            const srcName = nodeNameById.get(edge.source);
            const tgtName = nodeNameById.get(edge.target);
            if (srcName && tgtName) {
              (calleesByPath[edge.source] ??= []).push(tgtName);
              (callersByPath[edge.target] ??= []).push(srcName);
            }
          }
        }

        const enriched = candidates.map(r => ({
          name:       r.node.name,
          path:       r.node.path,
          type:       r.node.type ?? symbols[r.node.path]?.type ?? '',
          role:       roleByPath[r.node.path] ?? 'unknown',
          inbound:    r.inbound,
          outbound:   r.outbound,
          total:      r.total,
          totalFiles,
        }));
        const narratives = readingOrderNarrative.buildAll(enriched, totalFiles);
        const INTERNAL_TYPES = new Set(['module', 'file', 'unknown', '']);
        readingOrderNarrativeResult = enriched.map((f, i) => {
          const nodeId = f.path.replace(/\\/g, '/').replace(/^\.\//, '');
          const callers = [...new Set(callersByPath[nodeId] ?? [])].slice(0, 6);
          const callees = [...new Set(calleesByPath[nodeId] ?? [])].slice(0, 6);
          return {
            name:      f.name,
            path:      f.path,
            shortPath: f.path.replace(/\\/g, '/').split('/').slice(-2).join('/'),
            role:      f.role !== 'unknown' ? f.role : (!INTERNAL_TYPES.has((f.type ?? '').toLowerCase()) ? f.type : null),
            inbound:   f.inbound,
            outbound:  f.outbound,
            callers,
            callees,
            narrative: narratives[i],
          };
        });
      }
    }

    return {
      understanding,
      hubNarrative:                      { structural, directive: '' },
      businessPurposeNarrative:          businessPurposeNarrative.build(purposeData),
      codeHealthNarrative:               codeHealthNarrative.build(healthData),
      fileResponsibilitiesNarrative:     fileResponsibilitiesNarrativeResult,
      fileComponentsNarrative,
      folderResponsibilitiesNarrative:   folderResponsibilitiesNarrativeResult,
      folderWorkflowsNarrative:          folderWorkflowsNarrativeResult,
      debtHotspotsNarrative:             debtHotspotsNarrativeResult,
      readingOrder:                      readingOrderNarrativeResult,
    };
  }));

  // intelligence:hubDirective — pass 2 narrative, called after security + recommendations complete
  ipcMain.handle('intelligence:hubDirective', wrapHandler(async (_event, data) => {
    return hubNarrative.buildDirective(data);
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
      ? learningConcept.analyzeKnowledge(knowledge, session, understanding, scope)
      : learningConcept.analyzeFile(session, understanding);
  }));

  // intelligence:discoverDataFlows — discover data/workflow flows from knowledge + structure
  ipcMain.handle('intelligence:discoverDataFlows', wrapHandler(async (_event, knowledge, structure) => {
    return dataFlowDiscovery.discoverWorkflows(knowledge, structure);
  }));

  // intelligence:recommendations — accepts KnowledgeModel, adapts to engine's expected shape
  ipcMain.handle('intelligence:recommendations', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    console.log('[IPC] intelligence:recommendations targetType=' + model.targetType);
    const { knowledge, session } = adaptModelForEngines(model);
    const result = await (knowledge
      ? recommendations.analyzeKnowledge(knowledge)
      : recommendations.analyzeFile(session));
    console.log('[IPC] intelligence:recommendations done result=' + (result ? 'ok' : 'null'));
    return result;
  }));

  // intelligence:security — gather evidence for LLM-driven findings.
  // The derive stage produces a SecurityEvidenceReport; the generate tier (LLMSummaryService)
  // sends it to the LLM and writes confirmed findings back into model.ai.security.
  ipcMain.handle('intelligence:security', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    console.log('[IPC] intelligence:security targetType=' + model.targetType);

    const scope = model.targetType ?? 'repository';
    const languages = model.structure?.languages ?? [];

    // ── Build source file list with content ──────────────────────────────────
    let sourceFiles = [];

    if (model.targetType === 'file' && model.structure?.sourceCode) {
      sourceFiles = [{ path: model.structure.filePath ?? 'file', content: model.structure.sourceCode }];
    } else {
      // For folder/repository: read files from disk using repositoryPath + symbol keys
      const repositoryPath = model.metadata?.repositoryPath;
      const symbolPaths = Object.keys(model.structure?.symbols ?? {});

      if (repositoryPath && symbolPaths.length > 0) {
        for (const relPath of symbolPaths) {
          try {
            const absPath = nodePath.join(repositoryPath, relPath);
            const content = fs.readFileSync(absPath, 'utf8');
            sourceFiles.push({ path: relPath, content });
          } catch {
            // Skip unreadable files — the engine handles empty content gracefully
          }
        }
      }
    }

    const evidence = securityEvidence.gatherEvidence(sourceFiles, null, scope, languages);

    console.log('[IPC] intelligence:security evidence gathered candidates=' + evidence.candidates.length);

    return {
      evidence,
      findings: [],
      verificationChecks: [],
      overallRisk: 'low',
      securityMaturity: 'High',
      executiveSummary: '',
      summary: '',
      maturityContext: '',
      riskContext: '',
      hotspots: [],
      relevantComponents: [],
      recommendationThemes: [],
      readinessAssessment: '',
      generatedAt: new Date().toISOString(),
    };
  }));

  // intelligence:architectureAnalysis — AI-tier architecture analysis from KnowledgeModel
  ipcMain.handle('intelligence:architectureAnalysis', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    console.log('[IPC] intelligence:architectureAnalysis targetType=' + model.targetType);

    // The capability pipeline stores architecture as legacy string hints (confidence: null).
    // Replace them with proper ArchitectureDetectorEngine results for all scopes.
    const existingPatterns = model.relationships?.architecture?.patterns ?? [];
    const hasProperPatterns = existingPatterns.length > 0 && existingPatterns[0].confidence != null;
    let enrichedModel = model;
    if (!hasProperPatterns) {
      try {
        const structure = { root: model.structure?.folderTree };
        const graph = model.relationships?.dependencies?.graph ?? null;
        const detected = architectureDetector.detect(structure, graph);
        enrichedModel = {
          ...model,
          relationships: {
            ...model.relationships,
            architecture: { patterns: detected?.patterns ?? [] },
          },
        };
      } catch (e) { /* non-fatal — proceed without patterns */ }
    }

    const result = architectureAnalysis.analyze(enrichedModel);
    console.log('[IPC] intelligence:architectureAnalysis done result=' + (result ? 'ok' : 'null'));
    let diagram = '';
    try { diagram = architectureDiagram.build(model); } catch (e) { /* non-fatal */ }

    // Two-pass code health enrichment: architecture stage produces structural metrics
    // (hubCount, couplingAssessment, circularDependencyCount) that the understanding
    // stage didn't have. Overwrite codeHealthNarrative with the enriched version.
    const ins = model.insights ?? {};
    const symbols = model.structure?.symbols ?? {};
    let enrichedHealthNarrative = null;
    try {
      const healthData = {
        scope:                   model.targetType === 'file' ? 'file' : (Object.keys(symbols).length > 20 ? 'repository' : 'folder'),
        name:                    model.workspaceName ?? 'this',
        complexity:              ins.complexity      ?? 'Medium',
        maintainability:         ins.maintainability ?? 'Medium',
        riskCount:               (ins.risks ?? []).length,
        fileCount:               Object.keys(symbols).length,
        hubCount:                result.hubCount,
        couplingAssessment:      result.couplingAssessment,
        circularDependencyCount: result.circularDependencyCount,
      };
      enrichedHealthNarrative = codeHealthNarrative.build(healthData);
    } catch (e) { /* non-fatal */ }

    // ── Layer Breakdown narratives ────────────────────────────────────────────
    let layerBreakdownNarratives = null;
    if (result.layerBreakdown?.length) {
      const totalFiles = Object.keys(model.structure?.symbols ?? {}).length || (model.relationships?.dependencies?.graph?.nodes?.length ?? 0);
      const scope = model.targetType === 'repository' ? 'repository' : 'folder';
      try {
        const narratives = layerBreakdownNarrative.buildAll(result.layerBreakdown, result.dominantPattern, totalFiles, scope);
        layerBreakdownNarratives = result.layerBreakdown.map((l, i) => ({
          name:         l.name,
          fileCount:    l.fileCount,
          responsibility: l.responsibility,
          couplingNotes:  l.couplingNotes,
          narrative:    narratives[i],
        }));
      } catch (e) { /* non-fatal */ }
    }

    return { ...result, architectureDiagram: diagram, enrichedHealthNarrative, layerBreakdownNarratives };
  }));

  // intelligence:dataFlowAnalysis — AI-tier data flow analysis from KnowledgeModel
  ipcMain.handle('intelligence:dataFlowAnalysis', wrapHandler(async (_event, model) => {
    if (!model) throw new Error('model is required');
    console.log('[IPC] intelligence:dataFlowAnalysis targetType=' + model.targetType);
    const result = dataFlowAnalysis.analyze(model);
    console.log('[IPC] intelligence:dataFlowAnalysis done result=' + (result ? 'ok' : 'null'));

    // ── File-scope narrative enrichment ──────────────────────────────────────
    if (model.targetType === 'file') {
      const ins = model.insights ?? {};
      const s   = model.structure ?? {};
      const steps   = ins.dataFlow?.steps   ?? [];
      const inputs  = ins.dataFlow?.inputs  ?? [];
      const outputs = ins.dataFlow?.outputs ?? [];
      const language = s.fileLanguage ?? s.languages?.[0] ?? 'Unknown';
      const symbolEntry = Object.values(s.symbols ?? {})[0] ?? {};
      const fileType = symbolEntry.type ?? 'file';

      const flowData = { steps, inputs, outputs, language, fileType };

      const pattern       = dataFlowPattern.build(flowData);
      const stepNarrative = dataFlowStepsNarrative.build(flowData);

      let fileDiagram = null;
      try { fileDiagram = dataFlowDiagram.buildFileFlow({ steps, inputs, outputs }); } catch (e) { /* non-fatal */ }

      return { ...result, fileNarrative: { pattern, stepNarrative }, fileDiagram };
    }

    // ── Folder/repo: generate workflow diagram ────────────────────────────────
    let diagram = '';
    try {
      diagram = dataFlowDiagram.build(result, model.relationships?.dependencies?.graph ?? null, model.relationships?.dataFlowFacts ?? null);
    } catch (e) { /* non-fatal */ }

    // ── File Roles narratives ─────────────────────────────────────────────────
    let fileRolesResult = null;
    const facts = (model.relationships?.dataFlowFacts ?? []).filter(f => f.fileRole && f.fileRole !== 'unknown');
    if (facts.length > 0) {
      const scope = model.targetType === 'repository' ? 'repository' : 'folder';
      try {
        const narratives = fileRoleNarrative.buildAll(facts, scope);
        fileRolesResult = facts.map((f, i) => {
          const parts = f.path.replace(/\\/g, '/').split('/');
          const shortPath = parts.slice(-2).join('/');
          return {
            name:      parts[parts.length - 1],
            path:      f.path,
            shortPath,
            fileRole:  f.fileRole,
            sources:   f.sources,
            sinks:     f.sinks,
            narrative: narratives[i],
          };
        });
      } catch (e) { /* non-fatal */ }
    }

    return { ...result, dataFlowDiagram: diagram, fileRoles: fileRolesResult };
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
