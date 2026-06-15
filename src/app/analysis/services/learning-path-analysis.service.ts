import { Injectable } from '@angular/core';
import {
  LearningPathAnalysis,
  LearningStep,
  KeyConcept,
  SystemArea,
  SuggestedReadingItem,
  IgnoreForNow,
  NextStepLink,
} from '../models/learning-path-analysis.model';
import { SystemUnderstanding } from '../models/system-understanding.model';
import { AnalysisSession } from '../models/analysis-session.model';
import { RepositoryKnowledge, SourceFile, DependencyNode } from '@app/knowledge/models/knowledge.model';

// Domain concept keywords → plain English labels
const DOMAIN_HINTS: { pattern: RegExp; concept: string; definition: string }[] = [
  { pattern: /order/i,      concept: 'Order',      definition: 'A request from a customer to purchase something — the central transaction in the system.' },
  { pattern: /customer|client|user/i, concept: 'Customer', definition: 'The person or organisation that uses the system, places orders, or holds an account.' },
  { pattern: /product|item|sku/i,     concept: 'Product',  definition: 'Something the system sells, tracks, or manages — can be physical goods or digital services.' },
  { pattern: /payment|invoice|billing|charge/i, concept: 'Payment', definition: 'Money changing hands — authorisation, capture, refund, or reconciliation.' },
  { pattern: /policy|rule|config/i,   concept: 'Policy',   definition: 'A business rule that determines what is allowed — for example, pricing rules or access rules.' },
  { pattern: /claim|incident/i,       concept: 'Claim',    definition: 'A formal request made by a user — typically a support ticket, insurance claim, or refund request.' },
  { pattern: /workflow|process|pipeline/i, concept: 'Workflow', definition: 'A defined sequence of steps the system follows to complete a business task.' },
  { pattern: /auth|login|permission|role|access/i, concept: 'Authentication', definition: 'How the system knows who you are and what you are allowed to do.' },
  { pattern: /notification|email|message|alert/i, concept: 'Notification', definition: 'A message the system sends to inform a user or another system that something happened.' },
  { pattern: /report|analytics|dashboard/i, concept: 'Reporting', definition: 'Summarised views of data — how the system shows trends, counts, and summaries.' },
  { pattern: /fund|budget|account|ledger/i, concept: 'Funding', definition: 'Money allocation — how the system tracks what has been spent, committed, or available.' },
  { pattern: /schedule|calendar|appointment/i, concept: 'Scheduling', definition: 'Time-based coordination — booking, availability, or recurring tasks.' },
  { pattern: /service|api|endpoint|controller/i, concept: 'Service', definition: 'A piece of the system that handles a specific job — receives requests and returns results.' },
  { pattern: /model|entity|schema|table/i, concept: 'Data Model', definition: 'The structure that describes what information the system stores and how pieces relate to each other.' },
];

// Technology markers → system type label
const TECH_HINTS: { pattern: RegExp; label: string }[] = [
  { pattern: /angular/i,  label: 'an Angular frontend application' },
  { pattern: /react/i,    label: 'a React frontend application' },
  { pattern: /vue/i,      label: 'a Vue.js frontend application' },
  { pattern: /express|nest/i, label: 'a Node.js backend API' },
  { pattern: /django|flask/i, label: 'a Python web application' },
  { pattern: /spring/i,   label: 'a Java Spring backend service' },
  { pattern: /aspnet|dotnet|\.cs$/i, label: 'a .NET web application' },
  { pattern: /rails/i,    label: 'a Ruby on Rails application' },
  { pattern: /laravel/i,  label: 'a PHP Laravel application' },
];

// Area classification by folder/file naming
const AREA_PATTERNS: { pattern: RegExp; name: string; responsibility: string }[] = [
  { pattern: /component|ui|view|page/i,  name: 'User Interface',    responsibility: 'Everything the user sees and interacts with — screens, forms, and visual elements.' },
  { pattern: /service|provider/i,        name: 'Services',          responsibility: 'The application logic layer — services coordinate work between the UI and data.' },
  { pattern: /model|entity|schema/i,     name: 'Data Models',       responsibility: 'Definitions of the data structures the system works with — what information is stored and how.' },
  { pattern: /api|controller|endpoint/i, name: 'API Layer',         responsibility: 'The boundary between systems — where requests come in and responses go out.' },
  { pattern: /store|state|redux|ngrx/i,  name: 'State Management',  responsibility: 'Keeps track of what is happening in the app so different parts stay in sync.' },
  { pattern: /util|helper|shared/i,      name: 'Shared Utilities',  responsibility: 'Reusable tools and helpers that multiple parts of the system depend on.' },
  { pattern: /guard|auth|security/i,     name: 'Security Layer',    responsibility: 'Controls who can access what — authentication checks and permission enforcement.' },
  { pattern: /test|spec/i,               name: 'Tests',             responsibility: 'Automated checks that verify the system behaves correctly when changes are made.' },
  { pattern: /config|env|settings/i,     name: 'Configuration',     responsibility: 'Values that control how the application behaves in different environments.' },
  { pattern: /migration|seed|fixture/i,  name: 'Database Management', responsibility: 'Scripts that set up and evolve the database structure over time.' },
];

@Injectable({ providedIn: 'root' })
export class LearningPathAnalysisService {

  // ── File scope ─────────────────────────────────────────────────────────────

  analyzeFile(session: AnalysisSession, understanding: SystemUnderstanding): LearningPathAnalysis {
    const fileName = session.fileName;
    const lang = session.analysis.language ?? 'code';
    const systemType = this.inferSystemTypeFromFile(session);
    const systemName = this.cleanFileName(fileName);

    const roadmap = this.buildFileRoadmap(session, understanding);
    const keyConcepts = this.extractFileKeyConcepts(session, understanding);
    const systemAreas = this.buildFileAreas(session, understanding);
    const suggestedReadingOrder = this.buildFileReadingOrder(session, understanding);
    const ignoreForNow = this.buildFileIgnoreList(session, understanding);
    const nextSteps = this.buildFileNextSteps();

    return {
      scope: 'file',
      welcomeTitle: `Welcome to ${systemName}`,
      welcomeSummary: this.buildFileWelcome(session, understanding, systemType),
      systemType,
      focusFirst: this.buildFileFocusFirst(session, understanding),
      roadmap,
      keyConcepts,
      systemAreas,
      suggestedReadingOrder,
      ignoreForNow,
      nextSteps,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Folder / Repository scope ──────────────────────────────────────────────

  analyzeKnowledge(
    knowledge: RepositoryKnowledge,
    session: AnalysisSession | null,
    understanding: SystemUnderstanding,
    scope: 'folder' | 'repository',
  ): LearningPathAnalysis {
    const systemName = this.inferSystemName(knowledge, understanding);
    const systemType = this.inferSystemTypeFromKnowledge(knowledge, understanding);

    const roadmap = this.buildKnowledgeRoadmap(knowledge, understanding, scope);
    const keyConcepts = this.extractKnowledgeKeyConcepts(knowledge, understanding);
    const systemAreas = this.buildKnowledgeAreas(knowledge, understanding);
    const suggestedReadingOrder = this.buildKnowledgeReadingOrder(knowledge, understanding);
    const ignoreForNow = this.buildKnowledgeIgnoreList(knowledge, understanding);
    const nextSteps = this.buildKnowledgeNextSteps(scope);

    return {
      scope,
      welcomeTitle: `Welcome to ${systemName}`,
      welcomeSummary: this.buildKnowledgeWelcome(knowledge, understanding, systemType, systemName),
      systemType,
      focusFirst: this.buildKnowledgeFocusFirst(knowledge, understanding),
      roadmap,
      keyConcepts,
      systemAreas,
      suggestedReadingOrder,
      ignoreForNow,
      nextSteps,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── File helpers ───────────────────────────────────────────────────────────

  private buildFileWelcome(
    session: AnalysisSession,
    u: SystemUnderstanding,
    systemType: string,
  ): string {
    const purpose = u.businessPurpose || u.executiveSummary;
    return `This is ${systemType}. ${purpose} If you have not seen this file before, do not worry — this learning path will walk you through exactly what it does, why it exists, and what you need to understand first.`;
  }

  private buildFileFocusFirst(session: AnalysisSession, u: SystemUnderstanding): string {
    if (u.keyWorkflows.length > 0) return `Start by understanding what this file is responsible for: ${u.keyWorkflows[0]}.`;
    if (u.keyResponsibilities.length > 0) return `Start by reading the main responsibility: ${u.keyResponsibilities[0]}.`;
    return `Start by reading the file from top to bottom and identifying what problem it is solving.`;
  }

  private buildFileRoadmap(session: AnalysisSession, u: SystemUnderstanding): LearningStep[] {
    const steps: LearningStep[] = [];
    const fileName = session.fileName.split('/').pop() ?? session.fileName;

    steps.push({
      stepNumber: 1,
      title: 'Understand the Purpose',
      goal: u.businessPurpose || u.executiveSummary,
      whyItMatters: 'You cannot understand code without first understanding the problem it is solving. This context will make every line of code easier to read.',
      recommendedFiles: [fileName],
      recommendedFolders: [],
      checkpoints: [
        'You can explain what this file is responsible for in one sentence',
        'You understand what problem it is solving',
      ],
      whereToNext: 'Once you can describe the purpose clearly, move on to Step 2.',
    });

    if (u.keyResponsibilities.length > 0) {
      steps.push({
        stepNumber: 2,
        title: 'Learn the Key Responsibilities',
        goal: `This file handles: ${u.keyResponsibilities.slice(0, 3).join('; ')}.`,
        whyItMatters: 'Knowing what a piece of code is responsible for tells you where to look when something goes wrong and what to be careful about when making changes.',
        recommendedFiles: [fileName],
        recommendedFolders: [],
        checkpoints: [
          'You know what this file does',
          'You know what this file does not do',
          'You can identify the entry points',
        ],
        whereToNext: 'Move to Step 3 to trace the main workflow.',
      });
    }

    if (u.keyWorkflows.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Trace the Main Workflow',
        goal: `Follow the main execution path through this file: ${u.keyWorkflows[0]}.`,
        whyItMatters: 'A workflow shows you the sequence of steps the code takes. Following it from start to finish gives you a complete picture of what happens when this code runs.',
        recommendedFiles: [fileName],
        recommendedFolders: [],
        checkpoints: [
          'You can describe the sequence of steps from entry to exit',
          'You understand what triggers this code to run',
          'You know what it produces or returns',
        ],
        whereToNext: 'Move to Step 4 to understand how this file connects to the rest of the system.',
      });
    }

    if (u.mostImportantItems.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Study the Most Important Parts',
        goal: `Focus on: ${u.mostImportantItems.slice(0, 2).map(i => i.name).join(' and ')}.`,
        whyItMatters: u.mostImportantItems[0]?.whyImportant || 'These are the parts of the file that everything else depends on.',
        recommendedFiles: u.mostImportantItems.slice(0, 3).filter(i => i.path).map(i => i.path!),
        recommendedFolders: [],
        checkpoints: [
          `You understand the role of ${u.mostImportantItems[0]?.name ?? 'the key component'}`,
          'You can explain what it does when called',
        ],
        whereToNext: 'Move to Step 5 to understand how this file fits in the broader system.',
      });
    }

    steps.push({
      stepNumber: steps.length + 1,
      title: 'Understand the Broader Context',
      goal: 'Understand what calls this file and what this file calls.',
      whyItMatters: 'No file works in isolation. Understanding the call graph helps you predict the impact of any changes you make.',
      recommendedFiles: [],
      recommendedFolders: [],
      checkpoints: [
        'You know which other parts of the system depend on this file',
        'You know what external services or files this code calls',
        'You can estimate the blast radius of a change here',
      ],
      whereToNext: 'You are now ready to explore the broader system. Use the Architecture page to see how everything connects.',
    });

    return steps;
  }

  private extractFileKeyConcepts(session: AnalysisSession, u: SystemUnderstanding): KeyConcept[] {
    const text = `${session.fileName} ${u.businessPurpose} ${u.keyResponsibilities.join(' ')}`;
    return this.extractConceptsFromText(text, u);
  }

  private buildFileAreas(session: AnalysisSession, u: SystemUnderstanding): SystemArea[] {
    const areas: SystemArea[] = [];
    const ext = session.fileName.split('.').pop()?.toLowerCase() ?? '';
    const fileName = session.fileName.split('/').pop() ?? session.fileName;

    if (['ts', 'js', 'cs', 'py', 'java'].includes(ext)) {
      areas.push({
        name: 'This File',
        responsibility: u.businessPurpose || 'The logic implemented in this file.',
        whyItMatters: 'This is the code you are here to understand.',
        whenToLearnIt: 'Start here.',
        suggestedFiles: [fileName],
      });
    }

    if (u.coreCapabilities.length > 0) {
      for (const cap of u.coreCapabilities.slice(0, 3)) {
        areas.push({
          name: cap.name,
          responsibility: cap.description,
          whyItMatters: cap.businessValue,
          whenToLearnIt: 'Learn alongside the file itself.',
          suggestedFiles: [],
        });
      }
    }

    return areas;
  }

  private buildFileReadingOrder(session: AnalysisSession, u: SystemUnderstanding): SuggestedReadingItem[] {
    const items: SuggestedReadingItem[] = [];
    items.push({
      rank: 1,
      label: session.fileName,
      path: session.fileName,
      reason: 'This is the file you are studying. Read it from top to bottom before diving into any specific section.',
    });
    u.mostImportantItems.slice(0, 3).forEach((item, i) => {
      items.push({
        rank: i + 2,
        label: item.name,
        path: item.path || undefined,
        reason: item.whyImportant,
      });
    });
    return items;
  }

  private buildFileIgnoreList(session: AnalysisSession, u: SystemUnderstanding): IgnoreForNow[] {
    const ignore: IgnoreForNow[] = [];
    if (u.highRiskAreas.length > 0) {
      ignore.push({
        area: 'High-risk areas flagged in analysis',
        reason: 'These areas exist and are important, but they require deeper understanding before you modify them. Get familiar with the normal flow first.',
      });
    }
    ignore.push({
      area: 'Edge cases and error handling',
      reason: 'Error handling paths are important but should not be the first thing you read. Understand the happy path before exploring what happens when things go wrong.',
    });
    ignore.push({
      area: 'Test files',
      reason: 'Tests are valuable, but read the implementation first. You will get much more out of the tests once you understand what they are testing.',
    });
    return ignore;
  }

  private buildFileNextSteps(): NextStepLink[] {
    return [
      { destination: 'Architecture', route: '/file-analysis/architecture', guidance: 'To understand how this file fits into the overall structure of the application.' },
      { destination: 'Data Flow', route: '/file-analysis/data-flow', guidance: 'To trace how data moves through this file step by step.' },
      { destination: 'System Understanding', route: '/file-analysis/system-understanding', guidance: 'For a deeper analytical view of what this file does and why it matters.' },
      { destination: 'Recommendations', route: '/file-analysis/code-recommendations', guidance: 'To see specific improvement suggestions before making changes.' },
    ];
  }

  // ── Knowledge helpers ──────────────────────────────────────────────────────

  private buildKnowledgeWelcome(
    knowledge: RepositoryKnowledge,
    u: SystemUnderstanding,
    systemType: string,
    systemName: string,
  ): string {
    const fileCount = knowledge.sourceFiles?.length ?? 0;
    const purpose = u.businessPurpose || u.executiveSummary;
    const sizeDesc = fileCount > 100 ? 'a large' : fileCount > 30 ? 'a medium-sized' : 'a small';
    return `This is ${systemType} — ${sizeDesc} codebase with ${fileCount} source files. ${purpose} If you have never worked on this system before, this page will guide you through everything you need to understand first, in the right order, without overwhelming you.`;
  }

  private buildKnowledgeFocusFirst(knowledge: RepositoryKnowledge, u: SystemUnderstanding): string {
    if (u.mostImportantWorkflows && u.mostImportantWorkflows.length > 0) {
      return `Start by understanding the most important workflow: ${u.mostImportantWorkflows[0].name}. ${u.mostImportantWorkflows[0].description}`;
    }
    if (u.coreCapabilities.length > 0) {
      return `Start by understanding what this system is built to do: ${u.coreCapabilities[0].name}. ${u.coreCapabilities[0].description}`;
    }
    if (u.keyResponsibilities.length > 0) {
      return `Start with the primary responsibility: ${u.keyResponsibilities[0]}.`;
    }
    return 'Start by understanding the system\'s purpose before looking at any specific files.';
  }

  private buildKnowledgeRoadmap(
    knowledge: RepositoryKnowledge,
    u: SystemUnderstanding,
    scope: 'folder' | 'repository',
  ): LearningStep[] {
    const steps: LearningStep[] = [];
    const graph = knowledge.dependencyGraph;

    // Pre-compute hub files (high inbound reference count) for reuse across steps
    const inbound = new Map<string, number>();
    const nodeById = new Map<string, DependencyNode>();
    if (graph) {
      graph.nodes.forEach(n => nodeById.set(n.id, n));
      graph.edges.forEach(e => inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1));
    }

    const hubFiles = graph
      ? graph.nodes
          .filter(n => (inbound.get(n.id) ?? 0) >= 2)
          .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
          .slice(0, 10)
          .map(n => n.name || n.path || n.id)
      : [];

    const entryPointFiles = graph
      ? graph.nodes
          .filter(n => {
            const name = (n.name || n.path || '').toLowerCase();
            return /controller|entry|main|app\.|index\.|router|routes|bootstrap|startup|program/i.test(name);
          })
          .slice(0, 5)
          .map(n => n.name || n.path || n.id)
      : [];

    const serviceFiles = graph
      ? graph.nodes
          .filter(n => /service|provider/i.test(n.name || n.path || ''))
          .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
          .slice(0, 5)
          .map(n => n.name || n.path || n.id)
      : [];

    const modelFiles = graph
      ? graph.nodes
          .filter(n => /model|entity|schema|interface/i.test(n.name || n.path || ''))
          .slice(0, 5)
          .map(n => n.name || n.path || n.id)
      : [];

    // Derive top-level folders for folder recommendations
    const folderCounts = new Map<string, number>();
    if (graph) {
      for (const node of graph.nodes) {
        const folder = this.topFolder(node.path || node.name);
        if (folder) folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
      }
    }
    const topFolders = [...folderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([f]) => f);

    const coreFolders = topFolders.filter(f => /service|controller|api|core|domain|feature/i.test(f)).slice(0, 3);
    const dataFolders = topFolders.filter(f => /model|entity|schema|data|store/i.test(f)).slice(0, 2);

    // Step 1 — Business Purpose
    steps.push({
      stepNumber: 1,
      title: 'Business Purpose',
      goal: u.businessPurpose || u.executiveSummary,
      whyItMatters: 'Every technical decision in this codebase was made to solve a business problem. Understanding that problem first means every file you open will make immediate sense.',
      recommendedFiles: entryPointFiles.slice(0, 3).length > 0
        ? entryPointFiles.slice(0, 3)
        : hubFiles.slice(0, 2),
      recommendedFolders: topFolders.slice(0, 2),
      checkpoints: [
        'You can explain what this system does in one sentence',
        'You understand who uses it and why',
        'You know what the most important outcome the system produces',
      ],
      whereToNext: 'Once you can articulate the purpose, move to Step 2 to orient yourself in the codebase.',
    });

    // Step 2 — Core Workflow
    const topWorkflow = u.mostImportantWorkflows?.[0];
    const workflowTitle = topWorkflow?.name || (u.keyWorkflows[0] ?? 'Core Workflow');
    const workflowDesc = topWorkflow?.description || (u.keyWorkflows[0] ?? 'The primary process this system executes from start to finish.');
    steps.push({
      stepNumber: 2,
      title: `Core Workflow: ${workflowTitle}`,
      goal: workflowDesc,
      whyItMatters: 'This workflow connects the majority of business logic in the system. Following it end to end gives you more understanding than reading individual files in isolation.',
      recommendedFiles: [
        ...entryPointFiles.slice(0, 2),
        ...serviceFiles.slice(0, 3),
      ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
      recommendedFolders: coreFolders.slice(0, 2),
      checkpoints: [
        'You can trace the workflow from its trigger to its result',
        'You know which files are involved at each stage',
        'You understand what data is passed between steps',
      ],
      whereToNext: 'After tracing the workflow, move to Step 3 to understand the architectural structure.',
    });

    // Step 3 — Architecture
    const archFiles = [
      ...entryPointFiles.slice(0, 2),
      ...serviceFiles.slice(0, 2),
      ...hubFiles.slice(0, 2),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

    steps.push({
      stepNumber: 3,
      title: 'Architecture',
      goal: 'Learn how the major components are structured and how they interact.',
      whyItMatters: 'Architecture tells you the rules of the codebase — what depends on what and why. Once you understand the structure, you can navigate any unfamiliar file with confidence.',
      recommendedFiles: archFiles,
      recommendedFolders: topFolders.slice(0, 3),
      checkpoints: [
        'You understand the layering pattern used in this codebase',
        'You know how requests or inputs enter the system',
        'You can identify which layer owns which responsibility',
        'You understand dependency injection or the primary wiring pattern',
      ],
      whereToNext: 'Move to Step 4 to understand how data moves between components.',
    });

    // Step 4 — Data Movement
    const dataFiles = [
      ...modelFiles.slice(0, 3),
      ...serviceFiles.slice(0, 2),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

    steps.push({
      stepNumber: 4,
      title: 'Data Movement',
      goal: 'Trace how information enters the system, is transformed, and is returned or persisted.',
      whyItMatters: 'Most bugs occur at the boundaries between components — where data is passed from one part to another. Understanding data flow lets you predict where problems will occur.',
      recommendedFiles: dataFiles.length > 0 ? dataFiles : hubFiles.slice(0, 4),
      recommendedFolders: dataFolders,
      checkpoints: [
        'You can trace a piece of data from input to output',
        'You know which components transform data versus which pass it through',
        'You understand where data is validated and where it is trusted',
      ],
      whereToNext: 'Move to Step 5 to study the most important individual files.',
    });

    // Step 5 — Critical Components
    const importantItemFiles = u.mostImportantItems
      .slice(0, 5)
      .map(i => i.name || i.path || '')
      .filter(Boolean);

    const criticalFiles = [
      ...importantItemFiles,
      ...hubFiles.slice(0, 3),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

    steps.push({
      stepNumber: 5,
      title: 'Critical Components',
      goal: 'Read the files that are most widely referenced and most important to the system.',
      whyItMatters: 'Not all files are equally important. These files are referenced by the largest number of other modules. Reading them gives you maximum understanding per hour of effort.',
      recommendedFiles: criticalFiles,
      recommendedFolders: coreFolders,
      checkpoints: [
        'You can describe what each critical file is responsible for',
        'You understand why other files depend on these',
        'You know what to expect when you open any file that imports these components',
      ],
      whereToNext: scope === 'repository'
        ? 'Move to Step 6 to explore the advanced and specialist areas of the system.'
        : 'You now have a complete foundation to work confidently in this codebase.',
    });

    // Step 6 — Advanced Areas (repository scope only)
    if (scope === 'repository') {
      const advancedFolders = topFolders
        .filter(f => !/service|controller|model|entity|core|api/i.test(f))
        .slice(0, 3);

      const advancedFiles = graph
        ? graph.nodes
            .filter(n => (inbound.get(n.id) ?? 0) === 0)
            .filter(n => !/test|spec|config|env|migration/i.test(n.name || n.path || ''))
            .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
            .slice(0, 4)
            .map(n => n.name || n.path || n.id)
        : [];

      const depNames = u.mostImportantDependencies?.slice(0, 3).map(d => d.name) ?? [];

      steps.push({
        stepNumber: 6,
        title: 'Advanced Areas',
        goal: 'Explore the specialist subsystems, edge case handling, and external integrations.',
        whyItMatters: depNames.length > 0
          ? `This system integrates with ${depNames.join(', ')}. Understanding these integrations is necessary for advanced work and debugging production issues.`
          : 'Advanced areas require deeper context to work in safely. Approaching them after the core foundation means you will understand why they exist.',
        recommendedFiles: advancedFiles,
        recommendedFolders: advancedFolders,
        checkpoints: [
          'You understand which areas are specialist or high-risk',
          'You know what external systems this codebase integrates with',
          'You can identify what to be cautious about when making changes here',
        ],
        whereToNext: 'You now have a complete foundation. Use the Architecture and Data Flow pages for structural detail.',
      });
    }

    return steps;
  }

  private extractKnowledgeKeyConcepts(knowledge: RepositoryKnowledge, u: SystemUnderstanding): KeyConcept[] {
    const allText = [
      u.businessPurpose,
      u.executiveSummary,
      ...u.keyResponsibilities,
      ...u.keyWorkflows,
      ...(u.coreCapabilities.map(c => `${c.name} ${c.description}`)),
      ...(knowledge.sourceFiles?.slice(0, 20).map(f => f.path) ?? []),
    ].join(' ');

    return this.extractConceptsFromText(allText, u);
  }

  private buildKnowledgeAreas(knowledge: RepositoryKnowledge, u: SystemUnderstanding): SystemArea[] {
    const areas: SystemArea[] = [];
    const graph = knowledge.dependencyGraph;

    const inbound = new Map<string, number>();
    if (graph) graph.edges.forEach(e => inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1));

    if (!graph || graph.nodes.length === 0) {
      for (const cap of u.coreCapabilities.slice(0, 4)) {
        areas.push({
          name: cap.name,
          responsibility: cap.description,
          whyItMatters: cap.businessValue,
          whenToLearnIt: 'Learn in the order that matches your immediate task.',
          suggestedFiles: [],
        });
      }
      return areas;
    }

    const folderCounts = new Map<string, number>();
    const folderFiles = new Map<string, string[]>();
    for (const node of graph.nodes) {
      const folder = this.topFolder(node.path || node.name);
      if (!folder) continue;
      folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
      const name = node.name || node.path || node.id;
      if (name) {
        const existing = folderFiles.get(folder) ?? [];
        existing.push({ name, score: inbound.get(node.id) ?? 0 } as any);
        folderFiles.set(folder, existing);
      }
    }

    const topFolders = [...folderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([folder]) => folder);

    const seen = new Set<string>();
    for (const folder of topFolders) {
      const match = AREA_PATTERNS.find(p => p.pattern.test(folder));
      const areaName = match?.name ?? this.titleCase(folder);
      if (seen.has(areaName)) continue;
      seen.add(areaName);

      const responsibility = match?.responsibility ?? `Files related to ${folder} — review these when working in this part of the system.`;
      const isFoundational = /service|model|entity|api|controller/i.test(folder);
      const isLater = /test|spec|migration|config|util/i.test(folder);

      // Top files by inbound reference count within the folder
      const filesInFolder = (folderFiles.get(folder) ?? []) as any[];
      const topFilesInFolder = filesInFolder
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 4)
        .map((f: any) => f.name);

      areas.push({
        name: areaName,
        responsibility,
        whyItMatters: isFoundational
          ? 'This is a core area that most other parts of the system depend on. Understanding it is essential.'
          : 'This area handles a specific concern. Learn it when your work brings you here.',
        whenToLearnIt: isLater ? 'Leave for later.' : isFoundational ? 'Learn early.' : 'Learn when your task requires it.',
        suggestedFiles: topFilesInFolder,
      });
    }

    return areas.slice(0, 6);
  }

  private buildKnowledgeReadingOrder(knowledge: RepositoryKnowledge, u: SystemUnderstanding): SuggestedReadingItem[] {
    const items: SuggestedReadingItem[] = [];
    const graph = knowledge.dependencyGraph;

    // Most important items from system understanding (already ranked by service)
    u.mostImportantItems.slice(0, 3).forEach((item, i) => {
      items.push({
        rank: i + 1,
        label: item.name,
        path: item.path || undefined,
        reason: item.whyImportant,
      });
    });

    // Add hub nodes from dependency graph (high inbound = important to understand)
    if (graph && graph.nodes.length > 0) {
      const inbound = new Map<string, number>();
      graph.edges.forEach(e => inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1));

      const hubs = graph.nodes
        .filter(n => (inbound.get(n.id) ?? 0) >= 3)
        .sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0))
        .slice(0, 4);

      for (const hub of hubs) {
        if (items.some(i => i.path === hub.path || i.label === hub.name)) continue;
        items.push({
          rank: items.length + 1,
          label: hub.name,
          path: hub.path || undefined,
          reason: `${hub.name} is referenced by ${inbound.get(hub.id)} other modules. Understanding it early gives you insight into a large portion of the codebase at once.`,
        });
      }
    }

    // Add most important workflows from system understanding
    u.mostImportantWorkflows?.slice(0, 2).forEach(wf => {
      if (items.length >= 7) return;
      items.push({
        rank: items.length + 1,
        label: `Workflow: ${wf.name}`,
        reason: `${wf.description} Tracing this workflow end-to-end will teach you how the most important parts of the system work together.`,
      });
    });

    // Re-rank sequentially
    return items.slice(0, 7).map((item, i) => ({ ...item, rank: i + 1 }));
  }

  private buildKnowledgeIgnoreList(knowledge: RepositoryKnowledge, u: SystemUnderstanding): IgnoreForNow[] {
    const ignore: IgnoreForNow[] = [];
    const graph = knowledge.dependencyGraph;

    // Isolated files
    if (graph) {
      const connected = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
      const isolatedCount = graph.nodes.filter(n => !connected.has(n.id)).length;
      if (isolatedCount > 3) {
        ignore.push({
          area: `${isolatedCount} isolated files with no dependencies`,
          reason: 'These files are not connected to the rest of the system. They may be utilities, scripts, or unused code. You do not need to understand them to understand the system.',
        });
      }
    }

    // Technical debt hotspots
    if (u.technicalDebtHotspots && u.technicalDebtHotspots.length > 0) {
      ignore.push({
        area: `Legacy or debt-heavy files: ${u.technicalDebtHotspots.slice(0, 2).map(h => h.name).join(', ')}`,
        reason: 'These areas have accumulated technical debt over time and are harder to understand than the rest of the system. Leave them for later when you are already comfortable with the core.',
      });
    }

    // High-risk areas
    if (u.highRiskAreas.length > 0) {
      ignore.push({
        area: 'High-risk areas',
        reason: 'Flagged as high risk — not because they are unimportant, but because modifying them without deep context is dangerous. Understand the system first, then approach these carefully.',
      });
    }

    // Generic items always worth mentioning
    ignore.push({
      area: 'Test files and test utilities',
      reason: 'Tests are important but should not be your first reading. Understand the implementation first and the tests will make much more sense.',
    });

    ignore.push({
      area: 'Configuration and environment files',
      reason: 'These files control how the application runs in different environments. They rarely teach you how the system works — save them for when you are setting up a development environment.',
    });

    if (knowledge.sourceFiles && knowledge.sourceFiles.length > 50) {
      ignore.push({
        area: 'The full file tree',
        reason: `With ${knowledge.sourceFiles.length} files, trying to read everything is counterproductive. Follow the suggested reading order instead — it identifies the highest-value files.`,
      });
    }

    return ignore;
  }

  private buildKnowledgeNextSteps(scope: 'folder' | 'repository'): NextStepLink[] {
    const base = scope === 'repository' ? '/repository-analysis' : '/folder-analysis';
    const steps: NextStepLink[] = [
      { destination: 'Architecture', route: `${base}/architecture`, guidance: 'To understand how the system is structured and how major components relate to each other.' },
      { destination: 'Data Flow', route: `${base}/data-flow`, guidance: 'To trace how information moves through the system from input to output.' },
      { destination: 'System Understanding', route: `${base}/system-understanding`, guidance: 'For a deeper analytical view of the system\'s purpose, capabilities, and health.' },
      { destination: 'Recommendations', route: `${base}/code-recommendations`, guidance: 'To identify improvement opportunities before making changes to the system.' },
    ];
    if (scope === 'repository') {
      steps.push({ destination: 'Security', route: `${base}/security`, guidance: 'To understand the security posture and sensitive areas before working in the codebase.' });
    }
    return steps;
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  private extractConceptsFromText(text: string, u: SystemUnderstanding): KeyConcept[] {
    const found: KeyConcept[] = [];
    const seen = new Set<string>();

    for (const hint of DOMAIN_HINTS) {
      if (hint.pattern.test(text) && !seen.has(hint.concept)) {
        seen.add(hint.concept);
        const whereItAppears = u.mostImportantItems.find(i =>
          hint.pattern.test(i.name) || hint.pattern.test(i.whyImportant)
        )?.name ?? u.criticalAreas.find(a => hint.pattern.test(a)) ?? 'Throughout the system';

        found.push({
          name: hint.concept,
          plainEnglishDefinition: hint.definition,
          whyItMatters: `Understanding "${hint.concept}" is essential because it appears repeatedly throughout this codebase. If you encounter this term and do not know what it means, the surrounding code will not make sense.`,
          whereItAppears,
        });
      }
      if (found.length >= 6) break;
    }

    // If few domain hints matched, add capability-derived concepts
    if (found.length < 3) {
      for (const cap of u.coreCapabilities.slice(0, 3)) {
        if (seen.has(cap.name)) continue;
        seen.add(cap.name);
        found.push({
          name: cap.name,
          plainEnglishDefinition: cap.description,
          whyItMatters: cap.businessValue,
          whereItAppears: 'Core system capability',
        });
      }
    }

    return found.slice(0, 6);
  }

  private inferSystemTypeFromFile(session: AnalysisSession): string {
    const lang = (session.analysis.language ?? '').toLowerCase();
    const name = session.fileName.toLowerCase();
    for (const hint of TECH_HINTS) {
      if (hint.pattern.test(name)) return hint.label;
    }
    if (lang === 'typescript' || lang === 'javascript') return 'a TypeScript/JavaScript module';
    if (lang === 'c#') return 'a C# class';
    if (lang === 'python') return 'a Python module';
    return `a ${lang || 'code'} file`;
  }

  private inferSystemTypeFromKnowledge(knowledge: RepositoryKnowledge, u: SystemUnderstanding): string {
    const allText = [
      ...knowledge.sourceFiles?.slice(0, 30).map(f => f.path) ?? [],
      u.businessPurpose,
      u.executiveSummary,
    ].join(' ');

    for (const hint of TECH_HINTS) {
      if (hint.pattern.test(allText)) return hint.label;
    }

    const extCounts = new Map<string, number>();
    for (const f of knowledge.sourceFiles ?? []) {
      const ext = f.extension?.toLowerCase() ?? '';
      if (ext) extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
    }
    const dominant = [...extCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const extMap: Record<string, string> = {
        ts: 'a TypeScript application', js: 'a JavaScript application',
        cs: 'a .NET application', py: 'a Python application',
        java: 'a Java application', rb: 'a Ruby application',
        php: 'a PHP application', go: 'a Go application',
      };
      return extMap[dominant[0]] ?? `a ${dominant[0].toUpperCase()} codebase`;
    }
    return 'a multi-language codebase';
  }

  private inferSystemName(knowledge: RepositoryKnowledge, u: SystemUnderstanding): string {
    // Try to infer from package.json / project config file names
    const configFile = knowledge.sourceFiles?.find(f =>
      /package\.json|\.csproj|pom\.xml|build\.gradle|pyproject\.toml/.test(f.path)
    );
    if (configFile) {
      const match = configFile.content?.match(/"name"\s*:\s*"([^"]+)"/);
      if (match) return this.titleCase(match[1].replace(/[-_]/g, ' '));
    }
    // Fall back to capitalised first responsibility word or generic
    const firstWord = u.keyResponsibilities[0]?.split(' ')[0];
    return firstWord ? `${this.titleCase(firstWord)} System` : 'This System';
  }

  private topFolder(path: string): string | null {
    const parts = path.replace(/\\/g, '/').split('/');
    // Skip common root parts
    const skip = new Set(['src', 'app', 'lib', 'dist', 'build', '.']);
    for (const part of parts) {
      if (part && !skip.has(part) && !/\.\w+$/.test(part)) return part;
    }
    return null;
  }

  private cleanFileName(fileName: string): string {
    return fileName.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_.]/g, ' ') ?? fileName;
  }

  private titleCase(str: string): string {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
}
