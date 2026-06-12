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
import { RepositoryKnowledge, SourceFile, DependencyNode } from '../models/knowledge.model';

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

    steps.push({
      stepNumber: 1,
      title: 'Understand what this file is for',
      whatYouAreLearning: u.businessPurpose || u.executiveSummary,
      whyItMatters: 'You cannot understand code without first understanding the problem it is solving. This context will make every line of code easier to read.',
      whatYouWillGain: 'A clear mental model of why this file exists and what it is responsible for.',
      whereToNext: 'Once you understand the purpose, move on to Step 2 to learn what the file actually does.',
    });

    if (u.keyResponsibilities.length > 0) {
      steps.push({
        stepNumber: 2,
        title: 'Learn the key responsibilities',
        whatYouAreLearning: `This file handles: ${u.keyResponsibilities.slice(0, 3).join('; ')}.`,
        whyItMatters: 'Knowing what a piece of code is responsible for tells you where to look when something goes wrong and what to be careful about when making changes.',
        whatYouWillGain: 'Awareness of what this file does and what it does not do.',
        whereToNext: 'Move to Step 3 to understand how data moves through this file.',
      });
    }

    if (u.keyWorkflows.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Trace the main workflow',
        whatYouAreLearning: `Follow the main path through this file: ${u.keyWorkflows[0]}.`,
        whyItMatters: 'A workflow shows you the sequence of steps the code takes. Following it from start to finish gives you a complete picture of what happens when this code runs.',
        whatYouWillGain: 'Understanding of how the file behaves when it is actually used.',
        whereToNext: 'Move to Step 4 to understand how this file relates to the rest of the system.',
      });
    }

    if (u.mostImportantItems.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Study the most important parts',
        whatYouAreLearning: `Focus on: ${u.mostImportantItems.slice(0, 2).map(i => i.name).join(' and ')}.`,
        whyItMatters: u.mostImportantItems[0]?.whyImportant || 'These are the parts of the file that everything else depends on. Understanding them first makes the rest easier.',
        whatYouWillGain: 'Knowledge of the most critical functions or classes in this file.',
        whereToNext: 'Once comfortable, move to Step 5 to understand where this file fits in the broader system.',
      });
    }

    steps.push({
      stepNumber: steps.length + 1,
      title: 'Understand the broader context',
      whatYouAreLearning: 'How this file connects to the rest of the application.',
      whyItMatters: 'No file works in isolation. Understanding what calls this file — and what it calls — helps you predict the impact of any changes you make.',
      whatYouWillGain: 'Awareness of the blast radius of changes and what to test when modifying this file.',
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

    if (['ts', 'js', 'cs', 'py', 'java'].includes(ext)) {
      areas.push({
        name: 'This File',
        responsibility: u.businessPurpose || 'The logic implemented in this file.',
        whyItMatters: 'This is the code you are here to understand.',
        whenToLearnIt: 'Start here.',
      });
    }

    if (u.coreCapabilities.length > 0) {
      for (const cap of u.coreCapabilities.slice(0, 3)) {
        areas.push({
          name: cap.name,
          responsibility: cap.description,
          whyItMatters: cap.businessValue,
          whenToLearnIt: 'Learn alongside the file itself.',
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

    // Step 1 — always: understand the purpose
    steps.push({
      stepNumber: 1,
      title: 'Understand what this system is for',
      whatYouAreLearning: u.businessPurpose || u.executiveSummary,
      whyItMatters: 'Before you read a single line of code, you need to know what problem this system solves. Every technical decision will make more sense once you understand the purpose.',
      whatYouWillGain: 'A clear answer to the question "why does this system exist?"',
      whereToNext: 'Once you can explain the system\'s purpose in one sentence, move to Step 2.',
    });

    // Step 2 — major areas
    const areas = this.buildKnowledgeAreas(knowledge, u);
    if (areas.length > 0) {
      steps.push({
        stepNumber: 2,
        title: 'Learn the major areas of the application',
        whatYouAreLearning: `The system is divided into ${areas.length} main area${areas.length > 1 ? 's' : ''}: ${areas.slice(0, 3).map(a => a.name).join(', ')}.`,
        whyItMatters: 'Understanding the major areas gives you a map of the codebase. When something goes wrong, or when you need to add a feature, you will know immediately which area to look at.',
        whatYouWillGain: 'A mental map of the codebase — where things live and why.',
        whereToNext: 'After understanding the major areas, move to Step 3 to learn the most important workflow.',
      });
    }

    // Step 3 — most important workflow
    const topWorkflow = u.mostImportantWorkflows?.[0];
    if (topWorkflow) {
      steps.push({
        stepNumber: steps.length + 1,
        title: `Understand the most important workflow: ${topWorkflow.name}`,
        whatYouAreLearning: topWorkflow.description,
        whyItMatters: 'This workflow is the heart of the system. It is the path that matters most for both users and developers. If you understand this workflow completely, you understand the most valuable part of the codebase.',
        whatYouWillGain: 'End-to-end understanding of the most critical business process this system handles.',
        whereToNext: 'After tracing this workflow, move to Step 4 to understand how data moves.',
      });
    } else if (u.keyWorkflows.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Understand the main workflows',
        whatYouAreLearning: `The key workflows in this system: ${u.keyWorkflows.slice(0, 2).join('; ')}.`,
        whyItMatters: 'Workflows show you how the system behaves from end to end. Following a workflow from trigger to result is the fastest way to truly understand what the system does.',
        whatYouWillGain: 'Understanding of how the system\'s pieces work together to deliver a result.',
        whereToNext: 'Move to Step 4 to understand how data flows between components.',
      });
    }

    // Step 4 — how data moves
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Understand how data moves through the system',
      whatYouAreLearning: 'How information enters the system, gets transformed, stored, and returned.',
      whyItMatters: 'Most bugs happen at the boundaries between components — where data is passed from one part of the system to another. Understanding data flow helps you predict where problems occur.',
      whatYouWillGain: 'Ability to trace a piece of data from its source to its destination.',
      whereToNext: 'Move to Step 5 to learn the key concepts and business rules.',
    });

    // Step 5 — key concepts
    const concepts = this.extractKnowledgeKeyConcepts(knowledge, u);
    if (concepts.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Learn the key business concepts',
        whatYouAreLearning: `The important concepts in this system: ${concepts.slice(0, 3).map(c => c.name).join(', ')}.`,
        whyItMatters: 'Every system has its own vocabulary. Learning these concepts allows you to read code and have conversations with the team using the same language.',
        whatYouWillGain: 'Fluency in the domain language of this system.',
        whereToNext: 'Move to Step 6 to identify the most important files to read.',
      });
    }

    // Step 6 — important files
    const readingOrder = this.buildKnowledgeReadingOrder(knowledge, u);
    if (readingOrder.length > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Read the most important files',
        whatYouAreLearning: `Start with: ${readingOrder.slice(0, 3).map(r => r.label).join(', ')}.`,
        whyItMatters: 'Not all files are equally important. These files represent the core of the system. Reading them first gives you 80% of the understanding with a fraction of the effort.',
        whatYouWillGain: 'Deep familiarity with the files that matter most.',
        whereToNext: 'Once you have read the key files, you are ready to explore the full codebase on your own.',
      });
    }

    // Step 7 — dependencies (repo scope only)
    if (scope === 'repository' && u.mostImportantDependencies && u.mostImportantDependencies.length > 0) {
      const deps = u.mostImportantDependencies.slice(0, 3);
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Understand the external dependencies',
        whatYouAreLearning: `This system relies on: ${deps.map(d => d.name).join(', ')}.`,
        whyItMatters: deps[0]?.whyImportant || 'External dependencies are things this system cannot function without. Understanding them tells you the full picture of what the system depends on.',
        whatYouWillGain: 'Awareness of what third-party tools and services this system uses and why.',
        whereToNext: 'You now have a complete foundation. Explore the Architecture page for structural details.',
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

    if (!graph || graph.nodes.length === 0) {
      // Fallback: derive areas from capabilities
      for (const cap of u.coreCapabilities.slice(0, 4)) {
        areas.push({
          name: cap.name,
          responsibility: cap.description,
          whyItMatters: cap.businessValue,
          whenToLearnIt: 'Learn in the order that matches your immediate task.',
        });
      }
      return areas;
    }

    // Derive areas from folder structure via node paths
    const folderCounts = new Map<string, number>();
    for (const node of graph.nodes) {
      const folder = this.topFolder(node.path || node.name);
      if (folder) folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
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

      areas.push({
        name: areaName,
        responsibility,
        whyItMatters: isFoundational
          ? 'This is a core area that most other parts of the system depend on. Understanding it is essential.'
          : 'This area handles a specific concern. Learn it when your work brings you here.',
        whenToLearnIt: isLater ? 'Leave for later.' : isFoundational ? 'Learn early.' : 'Learn when your task requires it.',
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
