// External frameworks / runtime identifiers for dependency classification
const FRAMEWORK_KEYWORDS = [
  'angular', 'react', 'vue', 'next', 'nuxt', 'express', 'nest', 'fastapi',
  'django', 'flask', 'spring', 'aspnet', 'dotnet', 'rails', 'laravel',
];
const DATABASE_KEYWORDS = [
  'sql', 'postgres', 'mysql', 'mongo', 'redis', 'cosmos', 'sqlite', 'oracle',
  'ef', 'entity', 'dapper', 'typeorm', 'sequelize', 'prisma',
];
const QUEUE_KEYWORDS = ['rabbitmq', 'kafka', 'servicebus', 'sqs', 'pubsub', 'nats', 'eventbus'];
const STORAGE_KEYWORDS = ['blob', 's3', 'storage', 'gcs', 'minio', 'cdn', 'bucket'];

class SystemUnderstandingEngine {

  // ── File-scope ────────────────────────────────────────────────────────────

  analyzeFile(session) {
    const now = new Date().toISOString();
    const analysis = session.analysis;
    const ai = session.aiAnalysis;
    const fileName = session.fileName;

    const executiveSummary = ai?.summary || analysis.summary ||
      `${fileName} is a ${analysis.language} ${analysis.type} file.`;

    const businessPurpose = ai?.businessPurpose || analysis.businessPurpose ||
      `This file implements ${analysis.type.toLowerCase()} functionality within the application.`;

    const whyItMatters = this.deriveFileWhyItMatters(session);

    const keyResponsibilities = analysis.responsibilities.length > 0
      ? analysis.responsibilities
      : this.responsibilitiesFromSummary(analysis.summary);

    const keyWorkflows = this.workflowsFromDataFlow(analysis.dataFlow);

    const criticalAreas = this.fileCriticalAreas(session);

    const highRiskAreas = analysis.risks
      .filter(r => r.severity === 'high' || r.severity === 'critical')
      .map(r => r.description)
      .slice(0, 5);

    const mostImportantItems = this.extractFileFunctions(session);

    const coreCapabilities = this.buildFileCoreCapabilities(session);

    const { criticality, criticalityReason } = this.fileBusinessCriticality(session);

    const health = this.fileHealth(session);

    const understandingNarrative = ai?.explainSimpler || analysis.howItWorks ||
      this.buildFileNarrative(session);

    return {
      scope: 'file',
      executiveSummary,
      businessPurpose,
      whyItMatters,
      keyResponsibilities,
      keyWorkflows,
      criticalAreas,
      highRiskAreas,
      mostImportantItems,
      coreCapabilities,
      businessCriticality: criticality,
      businessCriticalityReason: criticalityReason,
      health,
      understandingNarrative,
      technicalDebtHotspots: null,
      mostImportantWorkflows: null,
      mostImportantDependencies: null,
      generatedAt: now,
    };
  }

  // ── Folder / Repository-scope ─────────────────────────────────────────────

  analyzeKnowledge(knowledge, session) {
    const now = new Date().toISOString();
    const isRepo = this.isRepositoryScope(knowledge);
    const ai = session?.aiAnalysis;
    const files = knowledge.sourceFiles ?? [];
    const graph = knowledge.dependencyGraph;
    const patterns = knowledge.architecture?.patterns ?? [];

    // ── Summary & purpose ────────────────────────────────────────────────────
    const primaryPattern = patterns[0]?.name ?? '';
    const langs = this.detectLanguages(files);
    const techs = this.detectTechnologies(files);

    const executiveSummary = ai?.summary ||
      this.buildKnowledgeSummary(files, patterns, langs, techs, isRepo);

    const businessPurpose = ai?.businessPurpose ||
      this.buildKnowledgeBusinessPurpose(files, patterns, techs, isRepo);

    const whyItMatters = this.buildKnowledgeWhyItMatters(files, graph, patterns, isRepo);

    // ── Key responsibilities ──────────────────────────────────────────────────
    const keyResponsibilities = this.buildKeyResponsibilities(files, patterns, primaryPattern, isRepo);

    // ── Key workflows ─────────────────────────────────────────────────────────
    const keyWorkflows = this.buildKeyWorkflows(files, graph);

    // ── Critical areas ────────────────────────────────────────────────────────
    const criticalAreas = this.buildCriticalAreas(files, graph, patterns);

    // ── High-risk areas ───────────────────────────────────────────────────────
    const highRiskAreas = this.buildHighRiskAreas(files, graph, session);

    // ── Most important items ─────────────────────────────────────────────────
    const mostImportantItems = this.buildMostImportantItems(files, graph, isRepo);

    // ── Business criticality ─────────────────────────────────────────────────
    const { criticality, criticalityReason } = this.knowledgeBusinessCriticality(files, graph, session);

    // ── Health ────────────────────────────────────────────────────────────────
    const health = this.knowledgeHealth(files, graph, session);

    // ── Narrative ─────────────────────────────────────────────────────────────
    const understandingNarrative = this.buildKnowledgeNarrative(
      files, graph, patterns, langs, techs, session, isRepo
    );

    // ── Core capabilities ────────────────────────────────────────────────────
    const coreCapabilities = this.buildKnowledgeCoreCapabilities(files, patterns, isRepo);

    // ── Repository-only sections ─────────────────────────────────────────────
    const technicalDebtHotspots = isRepo ? this.buildDebtHotspots(files, graph) : null;
    const mostImportantWorkflows = isRepo ? this.buildImportantWorkflows(files, graph) : null;
    const mostImportantDependencies = isRepo ? this.buildImportantDependencies(files) : null;

    return {
      scope: isRepo ? 'repository' : 'folder',
      executiveSummary,
      businessPurpose,
      whyItMatters,
      keyResponsibilities,
      keyWorkflows,
      criticalAreas,
      highRiskAreas,
      mostImportantItems,
      coreCapabilities,
      businessCriticality: criticality,
      businessCriticalityReason: criticalityReason,
      health,
      understandingNarrative,
      technicalDebtHotspots,
      mostImportantWorkflows,
      mostImportantDependencies,
      generatedAt: now,
    };
  }

  // ── File helpers ──────────────────────────────────────────────────────────

  deriveFileWhyItMatters(session) {
    const a = session.analysis;
    const outputs = a.outputs?.length ? a.outputs.slice(0, 2).join(' and ') : null;
    const type = (a.type || 'file').toLowerCase();
    const lang = a.language;

    if (a.whyItExists) return a.whyItExists;

    const base = `This ${lang} ${type} matters because `;
    if (outputs) return base + `it produces ${outputs}, which downstream components depend on.`;
    if (a.dependencies.length > 3)
      return base + `it acts as a central integration point, coordinating ${a.dependencies.length} dependencies.`;
    if (a.risks.some(r => r.severity === 'high' || r.severity === 'critical'))
      return base + `it handles high-risk operations that require careful attention.`;
    return base + `it encapsulates ${type} logic that supports the broader application.`;
  }

  fileCriticalAreas(session) {
    const areas = [];
    const a = session.analysis;

    // Dependencies are important to understand
    if (a.dependencies.length > 0) {
      areas.push(`Dependencies: ${a.dependencies.slice(0, 3).join(', ')}`);
    }
    // Architecture layers
    if (a.architectureLayers?.length > 0) {
      areas.push(`Architecture layer: ${a.architectureLayers.join(', ')}`);
    }
    // Outputs
    if (a.outputs?.length > 0) {
      areas.push(`Key outputs: ${a.outputs.slice(0, 3).join(', ')}`);
    }
    // Patterns in use
    if (a.patterns?.length > 0) {
      areas.push(`Design patterns: ${a.patterns.slice(0, 2).join(', ')}`);
    }

    return areas.slice(0, 5);
  }

  extractFileFunctions(session) {
    const a = session.analysis;
    const items = [];

    // Responsibilities become top-level "important items" at file scope
    for (const resp of a.responsibilities.slice(0, 5)) {
      items.push({
        name: resp.length > 60 ? resp.slice(0, 57) + '...' : resp,
        path: session.fileName,
        whyImportant: 'Core responsibility of this file.',
      });
    }

    if (items.length === 0 && a.inputs.length > 0) {
      items.push({
        name: `Primary inputs: ${a.inputs.slice(0, 2).join(', ')}`,
        path: session.fileName,
        whyImportant: 'Entry points into this file\'s logic.',
      });
    }

    return items;
  }

  fileBusinessCriticality(session) {
    const a = session.analysis;
    const hasHighRisk = a.risks.some(r => r.severity === 'high' || r.severity === 'critical');
    const manyDeps = a.dependencies.length >= 5;
    const isArchLayer = a.architectureLayers?.some(l =>
      ['service', 'controller', 'repository', 'gateway', 'core'].some(k => l.toLowerCase().includes(k))
    );

    if (hasHighRisk && (manyDeps || isArchLayer)) return {
      criticality: 'Critical',
      criticalityReason: 'High-risk operations combined with broad dependency exposure make this file critical to application stability.',
    };
    if (hasHighRisk || (manyDeps && isArchLayer)) return {
      criticality: 'High',
      criticalityReason: 'This file operates in a central or high-risk capacity within its architectural layer.',
    };
    if (manyDeps || isArchLayer) return {
      criticality: 'Medium',
      criticalityReason: 'This file has multiple dependents or occupies an important architectural layer.',
    };
    return {
      criticality: 'Low',
      criticalityReason: 'This file has limited scope and does not appear to be a critical dependency for other components.',
    };
  }

  fileHealth(session) {
    const a = session.analysis;
    const complexity = this.normalizeHealth(a.complexity);
    const maintainability = this.normalizeHealth(a.maintainability);
    const riskLevel = a.risks.some(r => r.severity === 'high' || r.severity === 'critical') ? 'Low'
      : a.risks.length > 2 ? 'Medium' : 'High';
    const modernizationReadiness = a.modernizationSuggestions.length >= 3 ? 'Low'
      : a.modernizationSuggestions.length >= 1 ? 'Medium' : 'High';

    const interpretation = this.buildHealthInterpretation(complexity, maintainability, riskLevel, modernizationReadiness);

    return { complexity, maintainability, riskLevel, modernizationReadiness, interpretation };
  }

  buildFileNarrative(session) {
    const a = session.analysis;
    const name = session.fileName;
    const parts = [];

    if (a.summary) parts.push(a.summary);
    if (a.howItWorks) parts.push(a.howItWorks);
    if (a.architecture) parts.push(`From an architectural standpoint: ${a.architecture}`);
    if (a.dataFlow) parts.push(`Data flows through this file as follows: ${a.dataFlow}`);
    if (a.developerNotes) parts.push(a.developerNotes);

    if (parts.length === 0) {
      return `${name} is a ${a.language} file implementing ${a.type} functionality. ` +
        `It has ${a.dependencies.length} dependencies and ${a.responsibilities.length} identified responsibilities.`;
    }

    return parts.join(' ');
  }

  workflowsFromDataFlow(dataFlow) {
    if (!dataFlow) return [];
    return dataFlow
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 200)
      .slice(0, 4);
  }

  responsibilitiesFromSummary(summary) {
    if (!summary) return [];
    return summary
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 4);
  }

  // ── Knowledge helpers ─────────────────────────────────────────────────────

  isRepositoryScope(knowledge) {
    return (knowledge.sourceFiles?.length ?? 0) > 20 ||
      (knowledge.architecture?.patterns?.length ?? 0) > 1 ||
      (knowledge.dependencyGraph?.nodes.length ?? 0) > 30;
  }

  detectLanguages(files) {
    const extMap = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      cs: 'C#', py: 'Python', java: 'Java', go: 'Go', rb: 'Ruby',
      php: 'PHP', swift: 'Swift', kt: 'Kotlin', rs: 'Rust',
    };
    const found = new Set();
    for (const f of files) {
      const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
      if (extMap[ext]) found.add(extMap[ext]);
    }
    return [...found];
  }

  detectTechnologies(files) {
    const techs = new Set();
    const sampleContent = files.slice(0, 30).map(f => f.content).join('\n').toLowerCase();

    if (sampleContent.includes('@angular')) techs.add('Angular');
    if (sampleContent.includes('react') && sampleContent.includes('jsx')) techs.add('React');
    if (sampleContent.includes('vue')) techs.add('Vue');
    if (sampleContent.includes('express')) techs.add('Express');
    if (sampleContent.includes('nestjs') || sampleContent.includes('@nestjs')) techs.add('NestJS');
    if (sampleContent.includes('entity framework') || sampleContent.includes('dbcontext')) techs.add('Entity Framework');
    if (sampleContent.includes('asp.net') || sampleContent.includes('[apicontroller]')) techs.add('ASP.NET');
    if (sampleContent.includes('django')) techs.add('Django');
    if (sampleContent.includes('spring boot')) techs.add('Spring Boot');

    return [...techs].slice(0, 5);
  }

  buildKnowledgeSummary(files, patterns, langs, techs, isRepo) {
    const scope = isRepo ? 'repository' : 'subsystem';
    const fileCount = files.length;
    const primaryLang = langs[0] ?? 'unknown language';
    const primaryPattern = patterns[0]?.name ?? '';
    const primaryTech = techs[0] ?? '';

    let summary = `This ${scope} contains ${fileCount} file${fileCount !== 1 ? 's' : ''} written primarily in ${primaryLang}`;
    if (primaryTech) summary += `, built with ${primaryTech}`;
    if (primaryPattern) summary += `. The codebase follows a ${primaryPattern} architectural pattern`;
    summary += '.';

    if (isRepo && patterns.length > 1) {
      summary += ` Additional patterns include ${patterns.slice(1, 3).map(p => p.name).join(' and ')}.`;
    }

    return summary;
  }

  buildKnowledgeBusinessPurpose(files, patterns, techs, isRepo) {
    const topFolders = this.extractTopFolders(files);
    const hasApi = topFolders.some(f => ['api', 'controllers', 'endpoints', 'routes'].includes(f));
    const hasUi = topFolders.some(f => ['components', 'pages', 'views', 'ui', 'frontend'].includes(f));
    const hasData = topFolders.some(f => ['models', 'entities', 'repositories', 'data', 'db'].includes(f));
    const hasServices = topFolders.some(f => ['services', 'business', 'domain', 'core'].includes(f));

    if (hasApi && hasUi && hasData) {
      return `This ${isRepo ? 'application' : 'subsystem'} implements a full-stack system with API endpoints, user interface components, and data access layers. It is responsible for handling end-to-end user interactions and data persistence.`;
    }
    if (hasApi && hasData) {
      return `This ${isRepo ? 'application' : 'subsystem'} provides a backend service exposing API endpoints with structured data access. It serves as a data provider or business logic layer for client applications.`;
    }
    if (hasUi) {
      return `This ${isRepo ? 'application' : 'subsystem'} focuses on the user interface layer, presenting data and capturing user interactions. It depends on backend services for data and business logic.`;
    }
    if (hasServices && hasData) {
      return `This ${isRepo ? 'application' : 'subsystem'} implements business logic and data management. It encapsulates domain rules and coordinates data operations across its components.`;
    }
    if (techs.length > 0) {
      return `This ${isRepo ? 'application' : 'subsystem'} is built using ${techs.join(', ')}. It provides ${patterns[0]?.name ? patterns[0].name + '-style' : 'structured'} functionality within the broader system.`;
    }
    return `This ${isRepo ? 'application' : 'subsystem'} provides ${topFolders.slice(0, 3).join(', ') || 'application'} functionality.`;
  }

  buildKnowledgeWhyItMatters(files, graph, patterns, isRepo) {
    const fileCount = files.length;
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;

    if (isRepo) {
      const coupling = edgeCount > 0 && nodeCount > 0 ? (edgeCount / nodeCount).toFixed(1) : '0';
      return `This repository represents a significant investment in software. With ${fileCount} files and approximately ${nodeCount} components interconnected by ${edgeCount} dependency relationships, understanding its structure is essential before making changes. The average coupling ratio of ${coupling} dependencies per component means modifications can have wide-reaching effects.`;
    }

    const patternStr = patterns[0]?.name ? ` using a ${patterns[0].name} pattern` : '';
    return `This subsystem of ${fileCount} files${patternStr} represents a discrete area of responsibility. Changes here can affect the components that depend on it, making it important to understand its contracts and boundaries before modifying behavior.`;
  }

  buildKeyResponsibilities(files, patterns, primaryPattern, isRepo) {
    const folders = this.extractTopFolders(files);
    const responsibilities = [];

    const layerMap = {
      controllers: 'Handle HTTP requests and coordinate responses',
      api: 'Expose API endpoints for external and internal consumers',
      services: 'Implement business logic and orchestrate operations',
      repositories: 'Manage data persistence and retrieval',
      models: 'Define data structures and domain entities',
      components: 'Render UI elements and manage user interactions',
      pages: 'Compose page-level views and manage routing',
      middleware: 'Process requests and responses in the pipeline',
      guards: 'Enforce authentication and authorization rules',
      utils: 'Provide reusable utility functions',
      helpers: 'Provide reusable helper logic',
      config: 'Manage application configuration and settings',
      migrations: 'Manage database schema evolution',
      tests: 'Validate application behavior through automated testing',
    };

    for (const folder of folders.slice(0, 6)) {
      if (layerMap[folder]) responsibilities.push(layerMap[folder]);
    }

    if (responsibilities.length === 0 && primaryPattern) {
      responsibilities.push(`Implement ${primaryPattern} architectural concerns`);
    }

    if (responsibilities.length < 3) {
      responsibilities.push(`Coordinate interactions between ${files.length} source files`);
    }

    return responsibilities.slice(0, 6);
  }

  buildKeyWorkflows(files, graph) {
    if (!graph || graph.nodes.length === 0) {
      return this.workflowsFromFolderNames(files);
    }

    // High-fanout nodes are likely workflow entry points
    const outboundMap = new Map();
    for (const edge of graph.edges) {
      outboundMap.set(edge.source, (outboundMap.get(edge.source) ?? 0) + 1);
    }

    const topNodes = graph.nodes
      .filter(n => (outboundMap.get(n.id) ?? 0) >= 3)
      .sort((a, b) => (outboundMap.get(b.id) ?? 0) - (outboundMap.get(a.id) ?? 0))
      .slice(0, 4);

    return topNodes.map(n => {
      const deps = outboundMap.get(n.id) ?? 0;
      return `${n.name} coordinates ${deps} downstream component${deps !== 1 ? 's' : ''}`;
    });
  }

  workflowsFromFolderNames(files) {
    const folders = this.extractTopFolders(files);
    const workflowFolders = folders.filter(f =>
      ['controllers', 'services', 'handlers', 'workflows', 'processes', 'jobs'].includes(f)
    );
    return workflowFolders.map(f => `${this.capitalize(f)} workflow layer`).slice(0, 4);
  }

  buildCriticalAreas(files, graph, patterns) {
    const areas = [];

    // High-inbound nodes = critical dependencies
    if (graph) {
      const inbound = new Map();
      for (const e of graph.edges) inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
      const topNodes = graph.nodes
        .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
        .slice(0, 3);
      for (const n of topNodes) {
        const count = inbound.get(n.id) ?? 0;
        if (count >= 2) areas.push(`${n.name} (depended on by ${count} components)`);
      }
    }

    // Architecture patterns are critical areas
    for (const p of patterns.slice(0, 2)) {
      areas.push(`${p.name} layer structure`);
    }

    // Dominant folders
    const folders = this.extractTopFolders(files);
    for (const f of folders.slice(0, 2)) {
      if (!areas.some(a => a.toLowerCase().includes(f))) {
        areas.push(`${this.capitalize(f)} subsystem`);
      }
    }

    return areas.slice(0, 6);
  }

  buildHighRiskAreas(files, graph, session) {
    const areas = [];

    // AI risks
    if (session?.aiAnalysis?.risks) {
      const highRisks = session.aiAnalysis.risks
        .filter(r => ['high', 'critical'].includes(r.severity?.toLowerCase() ?? ''))
        .slice(0, 3);
      areas.push(...highRisks.map(r => r.title));
    }

    // Files with suspicious names
    const suspiciousFiles = files
      .filter(f => {
        const name = (f.path.split('/').pop() ?? '').toLowerCase();
        return name.includes('legacy') || name.includes('old') || name.includes('deprecated') ||
          name.includes('hack') || name.includes('todo') || name.includes('fixme');
      })
      .slice(0, 3);
    for (const f of suspiciousFiles) {
      areas.push(`${f.path.split('/').pop()} (flagged naming)`);
    }

    // Highly coupled nodes with no clear single responsibility
    if (graph) {
      const inbound = new Map();
      const outbound = new Map();
      for (const e of graph.edges) {
        inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
        outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
      }
      const godNodes = graph.nodes.filter(n =>
        (inbound.get(n.id) ?? 0) >= 5 && (outbound.get(n.id) ?? 0) >= 5
      ).slice(0, 2);
      for (const n of godNodes) {
        areas.push(`${n.name} (high coupling — potential god object)`);
      }
    }

    return areas.slice(0, 6);
  }

  buildMostImportantItems(files, graph, isRepo) {
    if (graph && graph.nodes.length > 0) {
      const inbound = new Map();
      for (const e of graph.edges) inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);

      return graph.nodes
        .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
        .slice(0, isRepo ? 8 : 5)
        .map(n => ({
          name: n.name,
          path: n.path,
          whyImportant: `Depended on by ${inbound.get(n.id) ?? 0} other component${(inbound.get(n.id) ?? 0) !== 1 ? 's' : ''}.`,
        }));
    }

    // Fallback: largest files
    const sorted = [...files].sort((a, b) => (b).size - (a).size).slice(0, 5);
    return sorted.map(f => ({
      name: f.path.split('/').pop() ?? f.path,
      path: f.path,
      whyImportant: 'One of the larger files in this scope.',
    }));
  }

  knowledgeBusinessCriticality(files, graph, session) {
    const fileCount = files.length;
    const edgeCount = graph?.edges.length ?? 0;
    const nodeCount = graph?.nodes.length ?? 0;
    const hasHighRisk = session?.aiAnalysis?.risks?.some(
      r => ['high', 'critical'].includes(r.severity?.toLowerCase() ?? '')
    ) ?? false;

    // High coupling ratio = higher criticality
    const couplingRatio = nodeCount > 0 ? edgeCount / nodeCount : 0;

    if (fileCount > 100 || (couplingRatio > 4 && hasHighRisk)) {
      return {
        criticality: 'Critical',
        criticalityReason: `This ${fileCount > 100 ? 'large' : 'tightly coupled'} codebase with ${fileCount} files and high-risk findings represents critical organizational investment. Disruption here would have significant impact.`,
      };
    }
    if (fileCount > 30 || couplingRatio > 3) {
      return {
        criticality: 'High',
        criticalityReason: `With ${fileCount} files and ${edgeCount} inter-component dependencies, this codebase has high operational significance. Changes require careful planning.`,
      };
    }
    if (fileCount > 10 || couplingRatio > 1.5) {
      return {
        criticality: 'Medium',
        criticalityReason: `This moderately sized codebase serves a defined business function with ${nodeCount} components. It matters to the systems that depend on it.`,
      };
    }
    return {
      criticality: 'Low',
      criticalityReason: `This smaller scope of ${fileCount} files has limited coupling and can be understood and modified with contained risk.`,
    };
  }

  knowledgeHealth(files, graph, session) {
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;
    const couplingRatio = nodeCount > 0 ? edgeCount / nodeCount : 0;

    const complexity = couplingRatio > 4 ? 'Low' : couplingRatio > 2 ? 'Medium' : 'High';

    const modernizationCount = session?.aiAnalysis?.modernizations?.length ?? 0;
    const modernizationReadiness = modernizationCount >= 5 ? 'Low' : modernizationCount >= 2 ? 'Medium' : 'High';

    const riskCount = session?.aiAnalysis?.risks?.length ?? 0;
    const riskLevel = riskCount >= 5 ? 'Low' : riskCount >= 2 ? 'Medium' : 'High';

    // Maintainability: inversely related to file count and coupling
    const maintainability = files.length > 100 && couplingRatio > 3 ? 'Low'
      : files.length > 50 || couplingRatio > 2 ? 'Medium' : 'High';

    const interpretation = this.buildHealthInterpretation(complexity, maintainability, riskLevel, modernizationReadiness);

    return { complexity, maintainability, riskLevel, modernizationReadiness, interpretation };
  }

  buildKnowledgeNarrative(files, graph, patterns, langs, techs, session, isRepo) {
    if (session?.aiAnalysis?.explainSimpler) {
      return session.aiAnalysis.explainSimpler;
    }

    const scope = isRepo ? 'repository' : 'subsystem';
    const fileCount = files.length;
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;
    const primaryPattern = patterns[0]?.name ?? '';
    const primaryLang = langs[0] ?? 'the primary language';
    const primaryTech = techs[0] ?? '';
    const folders = this.extractTopFolders(files);

    const parts = [];

    // What it is
    let intro = `This ${scope} is a ${primaryLang}${primaryTech ? '/' + primaryTech : ''} codebase`;
    if (primaryPattern) intro += ` organized around a ${primaryPattern} architecture`;
    intro += `. It spans ${fileCount} files`;
    if (nodeCount > 0) intro += ` with ${nodeCount} identifiable components`;
    intro += '.';
    parts.push(intro);

    // How it's structured
    if (folders.length > 0) {
      const layerDesc = folders.slice(0, 4).map(f => this.capitalize(f)).join(', ');
      parts.push(`The codebase is organized into distinct layers: ${layerDesc}. This separation reflects ${primaryPattern ? 'the ' + primaryPattern + ' pattern\'s' : 'a'} commitment to separating concerns.`);
    }

    // How components interact
    if (nodeCount > 0 && edgeCount > 0) {
      const ratio = (edgeCount / nodeCount).toFixed(1);
      parts.push(`The dependency graph contains ${nodeCount} nodes connected by ${edgeCount} relationships — an average coupling ratio of ${ratio} dependencies per component. ${parseFloat(ratio) > 3 ? 'This relatively high coupling means changes propagate widely and should be planned carefully.' : 'This moderate coupling suggests well-defined component boundaries.'}`);
    }

    // Architecture observations
    if (patterns.length > 1) {
      const allPatterns = patterns.map(p => p.name).join(', ');
      parts.push(`Multiple architectural patterns were detected: ${allPatterns}. This suggests the codebase has evolved over time, potentially incorporating newer patterns alongside legacy approaches.`);
    }

    // Risk observations (repo only)
    if (isRepo && session?.aiAnalysis?.risks?.length) {
      const highRisks = session.aiAnalysis.risks.filter(r => ['high', 'critical'].includes(r.severity?.toLowerCase() ?? ''));
      if (highRisks.length > 0) {
        parts.push(`From a risk perspective, ${highRisks.length} significant concern${highRisks.length !== 1 ? 's were' : ' was'} identified during analysis. The most critical is: ${highRisks[0].title}. These warrant attention before undertaking significant changes.`);
      }
    }

    // What to know first
    if (isRepo) {
      parts.push(`To orient yourself quickly: start with the highest-dependency components, which represent the system's core contracts. From there, trace how data flows from entry points (controllers, handlers, or event listeners) through the business logic layer down to persistence. Understanding those paths will reveal how ${(this.extractTopFolders(files).slice(0, 2)).map(f => this.capitalize(f)).join(' and ')} fit together.`);
    } else {
      parts.push(`To understand this subsystem: identify which files are depended on most heavily — those represent its public contracts. Changes to those files cascade outward, while changes to leaf files (no dependents) are more contained.`);
    }

    return parts.join(' ');
  }

  buildDebtHotspots(files, graph) {
    const hotspots = [];

    if (graph) {
      const inbound = new Map();
      const outbound = new Map();
      for (const e of graph.edges) {
        inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
        outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
      }

      // God objects: high inbound + high outbound
      const godObjects = graph.nodes
        .filter(n => (inbound.get(n.id) ?? 0) >= 4 && (outbound.get(n.id) ?? 0) >= 4)
        .slice(0, 3);
      for (const n of godObjects) {
        hotspots.push({
          name: n.name,
          reason: `Handles ${inbound.get(n.id) ?? 0} inbound and ${outbound.get(n.id) ?? 0} outbound dependencies — classic god object pattern.`,
          impact: 'Changes here are high-risk and difficult to test in isolation. This is a common source of regressions.',
        });
      }
    }

    // Suspicious file names
    const legacyFiles = files
      .filter(f => {
        const name = (f.path.split('/').pop() ?? '').toLowerCase();
        return name.includes('legacy') || name.includes('old') || name.includes('v1') ||
          name.includes('deprecated') || name.includes('unused');
      })
      .slice(0, 3);
    for (const f of legacyFiles) {
      hotspots.push({
        name: f.path.split('/').pop() ?? f.path,
        reason: 'File name suggests this is legacy, deprecated, or superseded code.',
        impact: 'Legacy files accumulate technical debt and increase maintenance burden if not removed or refactored.',
      });
    }

    return hotspots.slice(0, 6);
  }

  buildImportantWorkflows(files, graph) {
    const workflows = [];

    if (graph && graph.nodes.length > 0) {
      const outbound = new Map();
      for (const e of graph.edges) outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);

      const topOrchestrators = graph.nodes
        .filter(n => (outbound.get(n.id) ?? 0) >= 3)
        .sort((a, b) => (outbound.get(b.id) ?? 0) - (outbound.get(a.id) ?? 0))
        .slice(0, 4);

      for (const n of topOrchestrators) {
        const deps = outbound.get(n.id) ?? 0;
        workflows.push({
          name: `${n.name} workflow`,
          description: `Orchestrates ${deps} downstream component${deps !== 1 ? 's' : ''}, making it a primary workflow entry point. Understanding this component reveals how the system handles its main operations.`,
        });
      }
    }

    if (workflows.length === 0) {
      const controllerFiles = files.filter(f => {
        const name = (f.path.split('/').pop() ?? '').toLowerCase();
        return name.includes('controller') || name.includes('handler') || name.includes('router');
      }).slice(0, 3);
      for (const f of controllerFiles) {
        workflows.push({
          name: f.path.split('/').pop() ?? f.path,
          description: 'Entry point for external requests, routing them to business logic.',
        });
      }
    }

    return workflows.slice(0, 5);
  }

  buildImportantDependencies(files) {
    const deps = [];
    const sampleContent = files.slice(0, 40).map(f => f.content).join('\n').toLowerCase();

    // Frameworks
    for (const fw of FRAMEWORK_KEYWORDS) {
      if (sampleContent.includes(fw)) {
        deps.push({
          name: this.capitalize(fw),
          type: 'framework',
          whyImportant: `Core framework providing the application's foundational structure and runtime.`,
        });
        if (deps.length >= 2) break;
      }
    }

    // Databases
    for (const db of DATABASE_KEYWORDS) {
      if (sampleContent.includes(db)) {
        const name = db === 'ef' ? 'Entity Framework' : this.capitalize(db);
        deps.push({
          name,
          type: 'database',
          whyImportant: 'Data persistence layer — changes to this integration affect all data read/write operations.',
        });
        if (deps.filter(d => d.type === 'database').length >= 2) break;
      }
    }

    // Queues
    for (const q of QUEUE_KEYWORDS) {
      if (sampleContent.includes(q)) {
        deps.push({
          name: this.capitalize(q),
          type: 'queue',
          whyImportant: 'Asynchronous messaging infrastructure — affects reliability and eventual consistency.',
        });
        break;
      }
    }

    // Storage
    for (const s of STORAGE_KEYWORDS) {
      if (sampleContent.includes(s) && !['storage'].includes(s)) {
        deps.push({
          name: this.capitalize(s),
          type: 'storage',
          whyImportant: 'Binary/object storage integration — affects file handling and media operations.',
        });
        break;
      }
    }

    return deps.slice(0, 6);
  }

  // ── Core capability builders ──────────────────────────────────────────────

  buildFileCoreCapabilities(session) {
    const a = session.analysis;
    const caps = [];

    // Derive from responsibilities
    for (const resp of a.responsibilities.slice(0, 4)) {
      caps.push({
        name: resp.length > 50 ? resp.slice(0, 47) + '...' : resp,
        description: `This file is responsible for ${resp.toLowerCase()}.`,
        businessValue: `Supports ${a.type.toLowerCase()} operations within the application.`,
      });
    }

    // Fallback from type
    if (caps.length === 0) {
      caps.push({
        name: `${a.type} functionality`,
        description: `Implements ${a.type.toLowerCase()} logic in ${a.language}.`,
        businessValue: 'Core application capability required for correct system behaviour.',
      });
    }

    return caps.slice(0, 4);
  }

  buildKnowledgeCoreCapabilities(files, patterns, isRepo) {
    const caps = [];
    const folders = this.extractTopFolders(files);

    const capabilityMap = {
      controllers: {
        name: 'Request Handling',
        description: 'Receives and routes incoming requests to the appropriate business logic.',
        businessValue: 'The primary entry point for external interactions with the system.',
      },
      api: {
        name: 'API Layer',
        description: 'Exposes structured endpoints consumed by clients and other services.',
        businessValue: 'Enables integration with external systems and client applications.',
      },
      services: {
        name: 'Business Logic',
        description: 'Implements the core rules, workflows, and operations of the domain.',
        businessValue: 'Encapsulates the most valuable and complex application behaviour.',
      },
      repositories: {
        name: 'Data Access',
        description: 'Manages reading and writing of data to the persistence layer.',
        businessValue: 'Ensures data integrity and provides a consistent interface to storage.',
      },
      models: {
        name: 'Domain Modelling',
        description: 'Defines the data structures and entities that represent the domain.',
        businessValue: 'Establishes the shared language and contracts used across the system.',
      },
      components: {
        name: 'User Interface',
        description: 'Renders interactive views and captures user input.',
        businessValue: 'Delivers the end-user experience and drives user adoption.',
      },
      pages: {
        name: 'Page Composition',
        description: 'Assembles full-page views from components and manages routing.',
        businessValue: 'Defines the navigable surfaces users interact with.',
      },
      guards: {
        name: 'Access Control',
        description: 'Enforces authentication and authorisation rules at route or request boundaries.',
        businessValue: 'Protects resources and ensures only authorised actors can perform actions.',
      },
      middleware: {
        name: 'Request Pipeline',
        description: 'Processes requests and responses as they pass through the system.',
        businessValue: 'Provides cross-cutting concerns like logging, validation, and transformation.',
      },
    };

    for (const folder of folders.slice(0, 6)) {
      if (capabilityMap[folder]) caps.push(capabilityMap[folder]);
    }

    // Pattern-based fallback
    if (caps.length === 0 && patterns[0]?.name) {
      caps.push({
        name: `${patterns[0].name} Architecture`,
        description: `Implements ${patterns[0].name} structural patterns across ${files.length} files.`,
        businessValue: isRepo ? 'Establishes the foundational structure of the application.' : 'Defines the structural approach for this subsystem.',
      });
    }

    return caps.slice(0, 5);
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  extractTopFolders(files) {
    const counts = new Map();
    for (const f of files) {
      const parts = f.path.split('/');
      if (parts.length >= 2) {
        const folder = parts[parts.length - 2].toLowerCase();
        counts.set(folder, (counts.get(folder) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([folder]) => folder)
      .filter(f => !['src', 'app', 'lib', 'dist', 'build', 'node_modules', '.'].includes(f));
  }

  normalizeHealth(raw) {
    const l = (raw ?? '').toLowerCase();
    if (l.includes('low') || l.includes('poor') || l.includes('bad') || l.includes('high complexity')) return 'Low';
    if (l.includes('medium') || l.includes('moderate') || l.includes('average')) return 'Medium';
    return 'High';
  }

  buildHealthInterpretation(complexity, maintainability, riskLevel, modernizationReadiness) {
    const scores = [complexity, maintainability, riskLevel, modernizationReadiness];
    const highs = scores.filter(s => s === 'High').length;
    const lows = scores.filter(s => s === 'Low').length;

    if (lows >= 3) return 'This codebase shows significant health concerns across multiple dimensions. Prioritize reducing complexity and risk before adding features.';
    if (lows === 2) return 'Several health indicators are concerning. Technical debt is accumulating and should be addressed systematically.';
    if (lows === 1) return 'Overall health is moderate with one dimension requiring attention. This is manageable with targeted effort.';
    if (highs >= 3) return 'This codebase is in good health. Complexity is manageable, maintainability is solid, and risk is low.';
    return 'Overall health is satisfactory. There are areas for improvement but no critical concerns.';
  }

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

module.exports = { SystemUnderstandingEngine };
