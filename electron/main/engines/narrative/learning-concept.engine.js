'use strict';

const { CodeConceptLocator } = require('../core/code-concept-locator');

// ── Concept metadata ──────────────────────────────────────────────────────────

const CONCEPT_DESCRIPTIONS = {
  'oop-design':
    'Object-Oriented Programming (OOP) structures code as classes — blueprints that bundle data and the methods that operate on it. Classes can inherit from other classes (extending their behaviour) or implement interfaces (fulfilling a contract). Understanding a class means understanding its fields (what state it holds), its public methods (what it offers callers), and its constructor (how it is initialised).',

  'data-transformation':
    'Data transformation is the practice of taking one data structure and producing another — mapping arrays, filtering collections, reducing to summaries, sorting, and reshaping objects. In JavaScript this is primarily expressed using array methods (map, filter, reduce) and object utilities (Object.keys, Object.entries). Pure transformation functions — those with no side effects — are the easiest code to understand and test because the output depends only on the input.',

  'dependency-injection':
    'Dependency Injection (DI) is a design pattern where a class declares its dependencies as constructor parameters instead of creating them itself. A container or framework provides the concrete instances at runtime. This decouples components from each other, making them easier to test in isolation and swap without changing the class itself.',

  'reactive-streams':
    'Reactive programming models asynchronous data as a stream of values over time — an Observable — rather than a single future value. Subscribers listen for emissions and react as each value arrives. Operators like map, filter, and switchMap let you transform and combine streams declaratively, keeping async logic composable and readable.',

  'authentication':
    'Authentication is the process of verifying who a caller is before granting access. In web applications this typically means validating a token (JWT, session cookie) on each request and attaching an identity to the request context. Middleware or guards intercept requests before they reach business logic, so most handlers can assume the caller is already verified.',

  'authorization':
    'Authorization determines what an authenticated caller is allowed to do. It runs after authentication and checks whether the verified identity has the required role, permission, or policy for the requested operation. Most frameworks separate these concerns — authentication establishes identity, authorization enforces access rules against it.',

  'data-modelling':
    'A data model defines the structure of the information your application stores and works with — which fields exist, their types, constraints, and how entities relate to each other. In code this appears as classes, interfaces, or schema definitions that both document the domain and drive database schema generation. Understanding the data model is essential before reading any business logic that manipulates it.',

  'async-patterns':
    'Asynchronous programming allows code to start an operation and continue other work while waiting for it to complete, rather than blocking. In modern JavaScript and C# this is expressed with async/await, which makes async code read like synchronous code while still being non-blocking. Promises and Tasks represent a single future value; Observables represent a stream.',

  'http-api':
    'An HTTP API exposes functionality over the web using standard verbs (GET, POST, PUT, DELETE) and URL routes. Controllers or route handlers map incoming requests to handler functions, which extract parameters, invoke business logic, and return structured responses. Understanding the API layer tells you all the entry points into the system from outside.',

  'state-management':
    'State management is a structured approach to keeping application data consistent across components that are not directly connected. Rather than passing data through props or ad-hoc shared variables, a central store holds the authoritative state. Components read from the store and dispatch actions to change it. This makes data flow predictable and debuggable.',

  'error-handling':
    'Error handling defines how the application responds when something goes wrong — whether to recover, retry, log, or propagate. Structured error handling separates the normal execution path from failure paths, preventing unexpected exceptions from reaching the user. Global handlers catch anything that escapes local try/catch blocks.',

  'testing':
    'Automated tests verify that code behaves correctly by running it with controlled inputs and asserting on its outputs. Unit tests cover individual functions in isolation; integration tests cover interactions between components. A good test suite tells you immediately when a change breaks existing behaviour, making it safe to refactor.',

  'security-patterns':
    'Security patterns are established techniques for protecting data and operations — hashing passwords, encrypting sensitive values, validating and sanitising inputs, and managing secrets through environment variables rather than hardcoded values. These patterns need to be applied consistently; a single gap can undermine the rest.',

  'orm-data-access':
    'An ORM (Object-Relational Mapper) abstracts database operations behind objects and method calls, so you write queries as code rather than raw SQL strings. This prevents SQL injection by design, handles type conversion, and makes queries composable. Understanding the ORM layer tells you how the application reads and writes its persistent data.',

  'frontend-components':
    'Frontend components are reusable, self-contained UI building blocks — each owns its template, styles, and the logic directly related to its view. Frameworks like Angular, React, and Vue structure applications as a tree of components. Understanding the component model tells you how data flows into a view, how events bubble out, and where to look when a UI behaviour needs to change.',

  'configuration':
    'Configuration separates values that change between environments (development, staging, production) from the code that uses them. These include database connection strings, API keys, feature flags, and timeout values. The standard practice is to read them from environment variables or a configuration service at startup, never hardcode them.',
};

const CONCEPT_WHY_HERE = {
  'oop-design': [
    {
      weight: 300,
      when: d => d.scope === 'file' && d.className && d.extendsClass,
      produce: d => `This file defines \`${d.className}\`, which extends \`${d.extendsClass}\`. To read it, start with the parent class to understand inherited behaviour, then come back here to see what it overrides or adds. The ${d.publicMethodCount > 0 ? d.publicMethodCount + ' public method' + (d.publicMethodCount !== 1 ? 's' : '') : 'methods'} here are what callers interact with.`,
    },
    {
      weight: 280,
      when: d => d.scope === 'file' && d.className && d.implementsStr,
      produce: d => `This file defines \`${d.className}\`, which implements \`${d.implementsStr}\`. That interface is the contract — read it first to understand what this class is required to do, then read the implementation to see how.`,
    },
    {
      weight: 250,
      when: d => d.scope === 'file' && d.className && (d.publicMethodCount ?? 0) > 0,
      produce: d => {
        const respNote = d.responsibilities?.length > 0
          ? ` Its main responsibility: ${d.responsibilities[0].toLowerCase()}.`
          : '';
        return `This file defines \`${d.className}\` with ${d.publicMethodCount} public method${d.publicMethodCount !== 1 ? 's' : ''}${d.constructorFound ? ' and a constructor that sets up its dependencies' : ''}.${respNote} Start with the constructor to understand what it needs, then read each public method to understand what it offers.`;
      },
    },
    {
      weight: 150,
      when: d => d.languages?.some(l => /typescript|javascript/i.test(l)),
      produce: () => `This codebase is built around JavaScript/TypeScript classes. Every engine, service, and component you open will be a class — reading one means finding its constructor, scanning its public methods, and understanding what state it holds internally.`,
    },
    {
      weight: 100,
      when: d => d.languages?.some(l => /c#|java|python/i.test(l)),
      produce: () => `This codebase uses OOP throughout. Classes are the primary unit of organisation — each one has a single responsibility, and understanding its public interface tells you everything callers need to know.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase is structured as a set of classes. Learn how to read a class — its constructor, its public methods, and what it inherits — before trying to trace any logic through it.`,
    },
  ],

  'data-transformation': [
    {
      weight: 250,
      when: d => d.scope === 'file' && (d.hitCount ?? 0) > 10 && d.usesReduce && d.usesObjectUtils,
      produce: d => {
        const respNote = d.responsibilities?.length > 0
          ? ` This file is responsible for: ${d.responsibilities.slice(0, 2).map(r => r.toLowerCase()).join(', ')}.`
          : '';
        return `This file performs ${d.hitCount} data transformation operations including reduce() and Object utilities — the most complex forms of reshaping.${respNote} To understand it, trace one map/filter/reduce at a time: what goes in, what comes out.`;
      },
    },
    {
      weight: 200,
      when: d => d.scope === 'file' && (d.hitCount ?? 0) > 10,
      produce: d => `This file performs ${d.hitCount} data transformation operations. The core logic here is about reshaping data — taking input structures and producing output structures. Follow the data through each map/filter/reduce to understand what the file is doing.`,
    },
    {
      weight: 150,
      when: d => d.scope === 'file' && (d.hitCount ?? 0) > 0,
      produce: d => `This file uses ${d.hitCount} array or object transformation operation${d.hitCount !== 1 ? 's' : ''}. Each one takes a collection and produces a new value — read them as data pipelines, not imperative loops.`,
    },
    {
      weight: 100,
      when: d => d.languages?.some(l => /typescript|javascript/i.test(l)),
      produce: () => `JavaScript array methods (map, filter, reduce) are used heavily throughout this codebase as the primary way to transform data. If you're not fluent in these, many core functions will be difficult to read. They replace what would be explicit for-loops in other languages.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase transforms data extensively — converting between shapes, filtering collections, and building result objects. Learn the transformation patterns before trying to reason about what data comes out the other end.`,
    },
  ],

  'dependency-injection': [
    {
      weight: 300,
      when: d => d.scope === 'file' && (d.injectedCount ?? 0) > 0 && d.frameworks?.some(f => /angular/i.test(f)),
      produce: d => {
        const names = d.injectedNames?.length > 0 ? d.injectedNames.join(', ') : 'several services';
        return `This class receives ${d.injectedCount} injected dependenc${d.injectedCount !== 1 ? 'ies' : 'y'} via its constructor: ${names}. Angular's injector provides these at runtime — you never instantiate this class with \`new\`. To understand what it can do, read what each injected service offers.`;
      },
    },
    {
      weight: 280,
      when: d => d.scope === 'file' && (d.injectedCount ?? 0) > 0,
      produce: d => {
        const names = d.injectedNames?.length > 0 ? d.injectedNames.join(', ') : 'its dependencies';
        return `This class declares ${d.injectedCount} constructor parameter${d.injectedCount !== 1 ? 's' : ''} — ${names} — injected by the DI container. It never creates these itself, which means you can substitute them in tests without changing this class.`;
      },
    },
    {
      weight: 200,
      when: d => d.frameworks?.some(f => /angular/i.test(f)),
      produce: () => `Angular's core architecture is built on DI — every service, component, and guard you encounter in this codebase is wired together by Angular's injector. You will see constructor injection in virtually every class.`,
    },
    {
      weight: 150,
      when: d => d.frameworks?.some(f => /nest/i.test(f)),
      produce: () => `NestJS uses DI as its primary wiring mechanism. Every provider is registered in a module and injected where needed — understanding this is necessary to trace how any request flows through the system.`,
    },
    {
      weight: 100,
      when: d => d.languages?.some(l => /c#/i.test(l)),
      produce: () => `ASP.NET Core's built-in DI container wires this codebase together. Services are registered in Program.cs or Startup.cs and injected via constructor parameters — following the dependency graph is how you navigate the system.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses dependency injection to wire its components. Understanding the pattern will let you trace how any class gets its collaborators and where to register new ones.`,
    },
  ],

  'reactive-streams': [
    {
      weight: 200,
      when: d => d.frameworks?.some(f => /angular/i.test(f)),
      produce: d => `Angular uses RxJS Observables throughout — for HTTP responses, route parameters, form value changes, and store subscriptions. You will encounter Observables constantly; knowing how to read a pipe chain is essential.`,
    },
    {
      weight: 100,
      when: d => (d.hitCount ?? 0) > 10,
      produce: d => `Reactive streams appear in ${d.hitCount} locations in this code. The codebase leans heavily on Observable-based async — async/await alone will not be enough to read it fluently.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses reactive streams for async data handling. Learn the Observable contract and the most common operators before reading the async paths.`,
    },
  ],

  'authentication': [
    {
      weight: 200,
      when: d => (d.unprotectedCount ?? 0) > 0,
      produce: d => `This system has ${d.unprotectedCount} public endpoint${d.unprotectedCount !== 1 ? 's' : ''} alongside protected ones. Understanding the auth layer tells you which endpoints require a valid identity and what form that takes.`,
    },
    {
      weight: 150,
      when: d => d.authFramework,
      produce: d => `Authentication is handled by ${d.authFramework}. Requests are validated at the middleware level before reaching any business logic — most handlers assume the caller is already authenticated.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase has an authentication layer that gates access to protected operations. Learn how it intercepts requests before reading the business logic it protects.`,
    },
  ],

  'authorization': [
    {
      weight: 200,
      when: d => (d.presenceOnlyCount ?? 0) > 0 && (d.roleScopedCount ?? 0) > 0,
      produce: d => `This system uses both role/policy-scoped authorization (${d.roleScopedCount} endpoint${d.roleScopedCount !== 1 ? 's' : ''}) and presence-only checks (${d.presenceOnlyCount}). Understanding the distinction matters when tracing who can do what.`,
    },
    {
      weight: 100,
      when: d => (d.roleScopedCount ?? 0) > 0,
      produce: d => `Access control is enforced with role or policy checks across ${d.roleScopedCount} location${d.roleScopedCount !== 1 ? 's' : ''}. You need to understand the authorization model to know what level of access each caller needs.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase enforces authorization beyond basic authentication — callers need specific roles or permissions for certain operations. Learn the policy model to understand what different users can do.`,
    },
  ],

  'data-modelling': [
    {
      weight: 200,
      when: d => (d.modelCount ?? 0) > 5,
      produce: d => `This codebase has ${d.modelCount} entity/model definitions. The data model is the vocabulary of the system — every service and controller speaks in terms of these types. Learn the core entities before reading business logic.`,
    },
    {
      weight: 100,
      when: d => d.ormFramework,
      produce: d => `Data is persisted via ${d.ormFramework}. Entity classes drive both the code and the database schema — understanding their shape and relationships is the foundation for reading any data-access code.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase defines structured data models that describe what the system stores. Learn these types before reading the services that work with them.`,
    },
  ],

  'async-patterns': [
    {
      weight: 250,
      when: d => d.scope === 'file' && (d.hitCount ?? 0) > 5 && d.usesPromiseAll,
      produce: d => `Async/await appears ${d.hitCount} times in this file and it uses Promise.all() — meaning it runs multiple async operations concurrently. You need to understand both the linear async chain and parallel coordination to follow the logic here.`,
    },
    {
      weight: 200,
      when: d => d.scope === 'file' && (d.hitCount ?? 0) > 5,
      produce: d => `Async/await appears ${d.hitCount} times in this file — it is the primary execution model here. You need to be comfortable reading async call chains to follow the logic.`,
    },
    {
      weight: 150,
      when: d => d.languages?.some(l => /typescript|javascript/i.test(l)),
      produce: () => `Node.js and browser JavaScript are single-threaded — all I/O is async. This codebase uses async/await throughout. Misreading an async boundary is one of the most common sources of hard-to-reproduce bugs.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses async patterns for I/O operations. Learn how async/await works in this language before tracing any code that interacts with databases, files, or external services.`,
    },
  ],

  'http-api': [
    {
      weight: 200,
      when: d => (d.endpointCount ?? 0) > 0,
      produce: d => `This codebase exposes ${d.endpointCount} HTTP endpoint${d.endpointCount !== 1 ? 's' : ''}. The API layer is the entry point for all external interaction — understanding it tells you what the system offers and where requests begin their journey through the code.`,
    },
    {
      weight: 100,
      when: d => d.frameworks?.some(f => /express|nest|fastify/i.test(f)),
      produce: d => `Routes are defined using ${d.frameworks.find(f => /express|nest|fastify/i.test(f))} conventions. Learn how route handlers are structured before reading the business logic they call.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase has an HTTP API layer. Understanding route definitions, parameter extraction, and response shaping is the first step to tracing how any request is handled.`,
    },
  ],

  'state-management': [
    {
      weight: 200,
      when: d => d.stateFramework,
      produce: d => `This application uses ${d.stateFramework} for state management. Component interactions flow through the store — without understanding the state model you will not be able to trace why a component renders the way it does.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses centralised state management. Learn the store shape and the action/reducer cycle before reading components that depend on shared state.`,
    },
  ],

  'error-handling': [
    {
      weight: 200,
      when: d => (d.emptyCatchCount ?? 0) > 0,
      produce: d => `${d.emptyCatchCount} empty catch block${d.emptyCatchCount !== 1 ? 's were' : ' was'} found. Silent error handling is a known risk here — learn the error-handling strategy so you can identify where failures may be silently swallowed.`,
    },
    {
      weight: 100,
      when: d => d.globalHandlerFound,
      produce: () => `A global exception handler is in place. Errors that escape local try/catch blocks are caught centrally — learn where this handler is and what it does before writing code that might throw.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase has structured error handling. Learn the error boundaries and how exceptions are caught or propagated before writing code that might fail.`,
    },
  ],

  'testing': [
    {
      weight: 200,
      when: d => (d.testFileCount ?? 0) > 0,
      produce: d => `This codebase has ${d.testFileCount} test file${d.testFileCount !== 1 ? 's' : ''}. Read the tests for a component alongside its implementation — they document expected behaviour and edge cases the source code does not make explicit.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `Automated tests are present. Learn the test structure and conventions before contributing — tests tell you what contracts the code is expected to uphold.`,
    },
  ],

  'security-patterns': [
    {
      weight: 200,
      when: d => d.algorithmsFound?.length > 0,
      produce: d => `Cryptographic operations use ${d.algorithmsFound.join(', ')}. Security-sensitive code requires careful reading — understand these patterns before making changes near anything that handles credentials, tokens, or sensitive data.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase implements security-sensitive patterns. Learn the conventions for secrets management and cryptography before working in these areas.`,
    },
  ],

  'orm-data-access': [
    {
      weight: 200,
      when: d => d.ormFramework,
      produce: d => `Data access is handled through ${d.ormFramework}. All reads and writes flow through the ORM layer — understanding its conventions is how you trace where data comes from and where it goes.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses an ORM or structured data access layer. Learn how queries are constructed and executed before reading the business logic that depends on them.`,
    },
  ],

  'frontend-components': [
    {
      weight: 200,
      when: d => d.frameworks?.some(f => /angular/i.test(f)),
      produce: () => `Angular applications are trees of components. Each component owns its template and interacts with services via DI. Learn the component lifecycle (ngOnInit, ngOnDestroy) and how inputs/outputs connect components before reading individual views.`,
    },
    {
      weight: 150,
      when: d => d.frameworks?.some(f => /react/i.test(f)),
      produce: () => `React components are functions that render UI from props and state. Learn hooks (useState, useEffect) and the component lifecycle before reading the views — they govern when and how components update.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase uses a component-based UI architecture. Learn how components receive data, handle events, and compose with each other before reading individual screens.`,
    },
  ],

  'configuration': [
    {
      weight: 200,
      when: d => (d.envVarCount ?? 0) > 5,
      produce: d => `${d.envVarCount} environment variable references were found. Configuration is kept out of code deliberately — know what each variable controls before running or deploying this system.`,
    },
    {
      weight: 50,
      when: () => true,
      produce: () => `This codebase reads configuration from the environment. Learn which settings are required and what they control before setting up a development environment or debugging environment-specific behaviour.`,
    },
  ],
};

// ── Technology hints ──────────────────────────────────────────────────────────

const TECH_HINTS = [
  { pattern: /angular/i,          label: 'an Angular frontend application',   frameworks: ['Angular'] },
  { pattern: /react/i,            label: 'a React frontend application',       frameworks: ['React'] },
  { pattern: /vue/i,              label: 'a Vue.js frontend application',      frameworks: ['Vue'] },
  { pattern: /express|nestjs/i,   label: 'a Node.js backend API',             frameworks: ['Express/NestJS'] },
  { pattern: /nest\b/i,           label: 'a NestJS API',                       frameworks: ['NestJS'] },
  { pattern: /express\b/i,        label: 'an Express.js API',                 frameworks: ['Express'] },
  { pattern: /django|flask/i,     label: 'a Python web application',          frameworks: ['Django/Flask'] },
  { pattern: /spring/i,           label: 'a Java Spring backend service',     frameworks: ['Spring'] },
  { pattern: /aspnet|dotnet/i,    label: 'a .NET web application',            frameworks: ['ASP.NET'] },
  { pattern: /rails/i,            label: 'a Ruby on Rails application',       frameworks: ['Rails'] },
  { pattern: /laravel/i,          label: 'a PHP Laravel application',         frameworks: ['Laravel'] },
];

// ── Concept priority order ────────────────────────────────────────────────────
// Lower number = higher priority. Discovery respects this order and stops at 7 steps.

const CONCEPT_PRIORITY = {
  // Foundational — must understand before anything else
  'oop-design':             1,
  'data-transformation':    2,
  // Core technical stack
  'frontend-components':    3,
  'http-api':               4,
  'dependency-injection':   5,
  'data-modelling':         6,
  'orm-data-access':        7,
  'async-patterns':         8,
  'reactive-streams':       9,
  // Cross-cutting concerns
  'state-management':       10,
  'authentication':         11,
  'authorization':          12,
  'error-handling':         13,
  // Specialist
  'security-patterns':      14,
  'configuration':          15,
  'testing':                16,
};

const MAX_STEPS = 7;

// ── Helper ────────────────────────────────────────────────────────────────────

function pick(conditions, data) {
  const matches = conditions
    .filter(c => c.when(data))
    .sort((a, b) => b.weight - a.weight);
  return matches.length ? matches[0].produce(data) : '';
}

function detectFrameworks(knowledge, session, understanding) {
  const allText = [
    ...(knowledge?.sourceFiles?.slice(0, 30).map(f => f.path) ?? []),
    ...(session?.analysis?.language ? [session.analysis.language] : []),
    understanding?.businessPurpose ?? '',
    understanding?.executiveSummary ?? '',
    ...(knowledge?.technologies ?? []),
    ...(knowledge?.frameworks ?? []),
  ].join(' ');

  const found = [];
  for (const hint of TECH_HINTS) {
    if (hint.pattern.test(allText)) {
      found.push(...hint.frameworks);
    }
  }
  return [...new Set(found)];
}

function detectLanguages(knowledge, session) {
  const langs = [];
  if (session?.analysis?.language) langs.push(session.analysis.language);
  if (knowledge?.sourceFiles) {
    for (const f of knowledge.sourceFiles.slice(0, 20)) {
      const ext = f.path?.split('.').pop()?.toLowerCase();
      const map = { ts: 'TypeScript', js: 'JavaScript', cs: 'C#', py: 'Python', java: 'Java' };
      if (map[ext] && !langs.includes(map[ext])) langs.push(map[ext]);
    }
  }
  return langs;
}

function systemTypeLabel(knowledge, session, understanding) {
  const allText = [
    ...(knowledge?.sourceFiles?.slice(0, 30).map(f => f.path) ?? []),
    session?.analysis?.language ?? '',
    understanding?.businessPurpose ?? '',
  ].join(' ');
  for (const hint of TECH_HINTS) {
    if (hint.pattern.test(allText)) return hint.label;
  }
  const ext = session?.fileName?.split('.').pop()?.toLowerCase();
  const extMap = { ts: 'a TypeScript module', js: 'a JavaScript module', cs: 'a C# class', py: 'a Python module' };
  return extMap[ext] ?? 'a code file';
}

function inferSystemName(knowledge, understanding) {
  const configFile = knowledge?.sourceFiles?.find(f =>
    /package\.json|\.csproj|pom\.xml|build\.gradle|pyproject\.toml/.test(f.path ?? '')
  );
  if (configFile?.content) {
    const match = configFile.content.match(/"name"\s*:\s*"([^"]+)"/);
    if (match) return match[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  const firstWord = understanding?.keyResponsibilities?.[0]?.split(' ')[0];
  return firstWord ? `${firstWord.replace(/\b\w/g, c => c.toUpperCase())} System` : 'This System';
}

function cleanFileName(fileName) {
  return fileName?.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_.]/g, ' ') ?? fileName;
}

// ── Main engine ───────────────────────────────────────────────────────────────

class LearningConceptEngine {

  constructor() {
    this._locator = new CodeConceptLocator();
  }

  // ── Public entry points ────────────────────────────────────────────────────

  analyzeFile(session, understanding) {
    const scope = 'file';
    const sourceCode = session.sourceCode ?? session.analysis?.sourceCode ?? '';
    const frameworks = detectFrameworks(null, session, understanding);
    const languages = detectLanguages(null, session);
    const systemType = systemTypeLabel(null, session, understanding);
    const systemName = cleanFileName(session.fileName);

    const discoveredKeys = this._discoverFileConceptKeys(session, understanding, frameworks, languages);
    const roadmap = this._buildRoadmap(discoveredKeys, scope, sourceCode, null, session, understanding, frameworks, languages);

    return {
      scope,
      welcomeTitle: `Learning Path: ${systemName}`,
      welcomeSummary: this._buildFileWelcomeSummary(session, understanding, systemType),
      systemType,
      focusFirst: this._buildFileFocusFirst(session, understanding),
      roadmap,
      generatedAt: new Date().toISOString(),
    };
  }

  analyzeKnowledge(knowledge, session, understanding, scope) {
    const frameworks = detectFrameworks(knowledge, session, understanding);
    const languages = detectLanguages(knowledge, session);
    const systemType = systemTypeLabel(knowledge, session, understanding);
    const systemName = inferSystemName(knowledge, understanding);

    const discoveredKeys = this._discoverKnowledgeConceptKeys(knowledge, session, understanding, frameworks, languages);
    const roadmap = this._buildRoadmap(discoveredKeys, scope, null, knowledge, session, understanding, frameworks, languages);

    return {
      scope,
      welcomeTitle: `Learning Path: ${systemName}`,
      welcomeSummary: this._buildKnowledgeWelcomeSummary(knowledge, understanding, systemType, systemName),
      systemType,
      focusFirst: this._buildKnowledgeFocusFirst(knowledge, understanding),
      roadmap,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Discovery passes ───────────────────────────────────────────────────────

  _discoverFileConceptKeys(session, understanding, frameworks, languages) {
    const analysis = session.analysis ?? {};
    const sourceCode = session.sourceCode ?? '';
    const candidates = [];

    // Check each concept key by scanning the file directly
    for (const key of this._locator.conceptKeys) {
      const ranges = this._locator.locateInFile(key, sourceCode, 1);
      if (ranges.length > 0) {
        candidates.push(key);
      }
    }

    // Also add framework-implied concepts not found via scan
    if (frameworks.some(f => /angular/i.test(f))) {
      for (const k of ['frontend-components', 'dependency-injection', 'reactive-streams']) {
        if (!candidates.includes(k)) candidates.push(k);
      }
    }
    if (frameworks.some(f => /react/i.test(f))) {
      if (!candidates.includes('frontend-components')) candidates.push('frontend-components');
    }

    return this._sortAndCap(candidates);
  }

  _discoverKnowledgeConceptKeys(knowledge, session, understanding, frameworks, languages) {
    const sourceFiles = knowledge?.sourceFiles ?? [];
    const candidates = [];

    // Check each concept key by scanning across all source files
    for (const key of this._locator.conceptKeys) {
      const paths = this._locator.locateInKnowledge(key, sourceFiles, 1);
      if (paths.length > 0) {
        candidates.push(key);
      }
    }

    // Augment frameworks from file path signals when technology detection had no config file
    // (e.g. analysing a subfolder that doesn't contain angular.json / package.json)
    const allPaths = sourceFiles.map(f => f.path ?? '').join(' ');
    const augFrameworks = [...frameworks];
    if (augFrameworks.every(f => !/angular/i.test(f)) &&
        /\.component\.ts|\.service\.ts|\.module\.ts|\.guard\.ts|\.directive\.ts/.test(allPaths)) {
      augFrameworks.push('Angular');
    }
    if (augFrameworks.every(f => !/react/i.test(f)) &&
        /\.tsx|useEffect|useState/.test(allPaths)) {
      augFrameworks.push('React');
    }

    // Framework-implied concepts
    if (augFrameworks.some(f => /angular/i.test(f))) {
      for (const k of ['frontend-components', 'dependency-injection', 'reactive-streams']) {
        if (!candidates.includes(k)) candidates.push(k);
      }
    }
    if (augFrameworks.some(f => /react/i.test(f))) {
      if (!candidates.includes('frontend-components')) candidates.push('frontend-components');
    }
    if (augFrameworks.some(f => /nest/i.test(f))) {
      if (!candidates.includes('dependency-injection')) candidates.push('dependency-injection');
    }

    // Language-implied baseline concepts when the scan found nothing
    if (candidates.length === 0) {
      if (languages.some(l => /typescript|javascript/i.test(l))) {
        for (const k of ['oop-design', 'async-patterns', 'data-transformation']) {
          candidates.push(k);
        }
      } else if (languages.some(l => /c#|java|python/i.test(l))) {
        for (const k of ['oop-design', 'async-patterns']) {
          candidates.push(k);
        }
      }
    }

    return this._sortAndCap(candidates);
  }

  _sortAndCap(keys) {
    return keys
      .sort((a, b) => (CONCEPT_PRIORITY[a] ?? 99) - (CONCEPT_PRIORITY[b] ?? 99))
      .slice(0, MAX_STEPS);
  }

  // ── Roadmap builder ────────────────────────────────────────────────────────

  _buildRoadmap(conceptKeys, scope, sourceCode, knowledge, session, understanding, frameworks, languages) {
    const sourceFiles = knowledge?.sourceFiles ?? [];

    return conceptKeys.map((key, i) => {
      // Locate where this concept appears in the code
      let codeLocations = [];
      if (scope === 'file' && sourceCode) {
        const ranges = this._locator.locateInFile(key, sourceCode);
        codeLocations = ranges.map(r => ({
          label: r.label.length > 60 ? r.label.slice(0, 57) + '…' : r.label,
          lineStart: r.lineStart,
          lineEnd: r.lineEnd,
        }));
      } else if (sourceFiles.length > 0) {
        const paths = this._locator.locateInKnowledge(key, sourceFiles);
        if (paths.length > 0) {
          codeLocations = [{ label: `Used across ${paths.length} file${paths.length !== 1 ? 's' : ''}`, filePaths: paths }];
        }
      }

      // Build whyHere evidence data for narrative conditions
      const evidenceData = this._gatherEvidence(key, scope, sourceCode, sourceFiles, frameworks, languages, understanding, session?.analysis);

      const description = CONCEPT_DESCRIPTIONS[key] ?? `${key} is a concept used in this codebase.`;
      const whyHere = CONCEPT_WHY_HERE[key]
        ? pick(CONCEPT_WHY_HERE[key], evidenceData)
        : `This concept appears in the analysed code and is required to work effectively here.`;

      const checkpoints = this._buildCheckpoints(key, evidenceData, scope);

      return {
        stepNumber: i + 1,
        title: this._conceptTitle(key),
        description,
        whyHere,
        codeLocations,
        checkpoints,
      };
    });
  }

  // ── Evidence gathering for whyHere conditions ─────────────────────────────

  _gatherEvidence(key, scope, sourceCode, sourceFiles, frameworks, languages, understanding, analysis) {
    const base = { scope, frameworks, languages };

    switch (key) {
      case 'oop-design': {
        const src = sourceCode ?? '';
        // Extract the primary class name and what it extends/implements
        const classMatch = src.match(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
        const className = classMatch?.[1] ?? null;
        const extendsClass = classMatch?.[2] ?? null;
        const implementsStr = classMatch?.[3]?.trim() ?? null;
        // Count public methods: lines that look like method definitions (not constructor, not private/protected)
        const publicMethodCount = (src.match(/^\s*(?:(?:public|static|async|get|set)\s+)+\w+\s*\(/mg) ?? []).length;
        const constructorFound = /\bconstructor\s*\(/.test(src);
        // From analysis: responsibilities give a sense of what the class does
        const responsibilities = analysis?.responsibilities ?? understanding?.keyResponsibilities ?? [];
        return { ...base, className, extendsClass, implementsStr, publicMethodCount, constructorFound, responsibilities };
      }
      case 'data-transformation': {
        const content = sourceCode ?? sourceFiles.slice(0, 5).map(f => f.content).join('\n');
        // Broader count: array methods + object utilities + string transforms
        const hitCount = (content.match(
          /\bmap\s*\(|\.filter\s*\(|\.reduce\s*\(|\.flatMap\s*\(|\.forEach\s*\(|\.find\s*\(|\.some\s*\(|\.every\s*\(|\.sort\s*\(|\.slice\s*\(|Object\.keys\s*\(|Object\.entries\s*\(|Object\.values\s*\(|\.join\s*\(|\.split\s*\(|\.replace\s*\(/g
        ) ?? []).length;
        const usesReduce = /\.reduce\s*\(/.test(content);
        const usesObjectUtils = /Object\.(keys|entries|values)\s*\(/.test(content);
        const responsibilities = analysis?.responsibilities ?? understanding?.keyResponsibilities ?? [];
        return { ...base, hitCount, usesReduce, usesObjectUtils, responsibilities };
      }
      case 'async-patterns': {
        const content = sourceCode ?? sourceFiles.slice(0, 5).map(f => f.content).join('\n');
        const hitCount = (content.match(/\basync\s|\bawait\s/g) ?? []).length;
        const usesPromiseAll = /Promise\.all\s*\(/.test(content);
        const fileType = analysis?.type ?? null;
        return { ...base, hitCount, usesPromiseAll, fileType };
      }
      case 'dependency-injection': {
        const src = sourceCode ?? '';
        // Count injected constructor params (typed params: name: Type)
        const ctorMatch = src.match(/constructor\s*\(([^)]*)\)/);
        const ctorParams = ctorMatch?.[1]
          ? ctorMatch[1].split(',').map(p => p.trim()).filter(p => /:\s*\w/.test(p))
          : [];
        const injectedCount = ctorParams.length;
        const injectedNames = ctorParams.map(p => {
          const m = p.match(/(?:private|public|protected|readonly|\s)*(\w+)\s*:/);
          return m?.[1] ?? null;
        }).filter(Boolean).slice(0, 4);
        return { ...base, injectedCount, injectedNames };
      }
      case 'reactive-streams': {
        const hitCount = scope === 'file'
          ? (this._locator.locateInFile(key, sourceCode ?? '', 50).length)
          : (this._locator.locateInKnowledge(key, sourceFiles).length);
        return { ...base, hitCount };
      }
      case 'authentication': {
        const unprotectedCount = scope === 'file'
          ? 0
          : sourceFiles.filter(f => /@Get\(|@Post\(|\[HttpGet\]|\[HttpPost\]|router\.(get|post)/.test(f.content ?? '') &&
              !/@Authorize|\[Authorize\]|requireAuth|AuthGuard/.test(f.content ?? '')).length;
        const authFramework = frameworks.find(f => /asp\.net|passport|nest|spring/i.test(f)) ?? null;
        return { ...base, unprotectedCount, authFramework };
      }
      case 'authorization': {
        let roleScopedCount = 0, presenceOnlyCount = 0;
        const files = scope === 'file' ? (sourceCode ? [{ content: sourceCode }] : []) : sourceFiles;
        for (const f of files) {
          if (/Roles=|Policy=|HasPermission|IsInRole/.test(f.content ?? '')) roleScopedCount++;
          else if (/\[Authorize\]|canActivate|requireAuth/.test(f.content ?? '')) presenceOnlyCount++;
        }
        return { ...base, roleScopedCount, presenceOnlyCount };
      }
      case 'data-modelling': {
        const modelCount = scope === 'file' ? 1 : sourceFiles.filter(f => /model|entity|schema/i.test(f.path ?? '')).length;
        const ormFramework = this._detectOrm(frameworks, sourceFiles, sourceCode);
        return { ...base, modelCount, ormFramework };
      }
      case 'orm-data-access': {
        const ormFramework = this._detectOrm(frameworks, sourceFiles, sourceCode);
        return { ...base, ormFramework };
      }
      case 'http-api': {
        const endpointCount = scope === 'file'
          ? ((sourceCode ?? '').match(/@(Get|Post|Put|Delete|Patch)\(|\[Http(Get|Post|Put|Delete)\]|router\.(get|post|put|delete)/g) ?? []).length
          : sourceFiles.filter(f => /@(Get|Post|Put|Delete|Patch)\(|\[Http(Get|Post|Put|Delete)\]/.test(f.content ?? '')).length;
        return { ...base, endpointCount };
      }
      case 'state-management': {
        const stateFramework = frameworks.find(f => /ngrx|redux|vuex|pinia/i.test(f)) ?? null;
        return { ...base, stateFramework };
      }
      case 'error-handling': {
        const content = sourceCode ?? sourceFiles.slice(0, 10).map(f => f.content).join('\n');
        const emptyCatchCount = (content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) ?? []).length;
        const globalHandlerFound = /UseExceptionHandler|app\.use\s*\(\s*\(err|GlobalExceptionFilter/.test(content);
        return { ...base, emptyCatchCount, globalHandlerFound };
      }
      case 'testing': {
        const testFileCount = scope === 'file' ? 0 : sourceFiles.filter(f => /\.spec\.|\.test\.|_test\.|Test\./.test(f.path ?? '')).length;
        return { ...base, testFileCount };
      }
      case 'security-patterns': {
        const content = sourceCode ?? sourceFiles.slice(0, 20).map(f => f.content).join('\n');
        const algorithmsFound = [];
        for (const alg of ['bcrypt', 'argon2', 'PBKDF2', 'AES', 'RSA', 'SHA256']) {
          if (new RegExp(alg, 'i').test(content)) algorithmsFound.push(alg);
        }
        return { ...base, algorithmsFound };
      }
      case 'configuration': {
        const content = sourceCode ?? sourceFiles.slice(0, 20).map(f => f.content).join('\n');
        const envVarCount = (content.match(/process\.env\.\w+|Environment\.GetEnvironmentVariable/g) ?? []).length;
        return { ...base, envVarCount };
      }
      default:
        return base;
    }
  }

  _detectOrm(frameworks, sourceFiles, sourceCode) {
    const content = sourceCode ?? sourceFiles?.slice(0, 10).map(f => f.content).join('\n') ?? '';
    if (/TypeORM/i.test(content)) return 'TypeORM';
    if (/EntityFramework|DbContext/i.test(content)) return 'Entity Framework';
    if (/mongoose/i.test(content)) return 'Mongoose';
    if (/Sequelize/i.test(content)) return 'Sequelize';
    if (/Dapper/i.test(content)) return 'Dapper';
    if (/Hibernate/i.test(content)) return 'Hibernate';
    if (frameworks.some(f => /typeorm/i.test(f))) return 'TypeORM';
    return null;
  }

  // ── Checkpoints ────────────────────────────────────────────────────────────

  _buildCheckpoints(key, evidence, scope) {
    const base = {
      'oop-design': [
        'You can read a class and identify: what state it holds, what its public methods do, what it inherits',
        'You understand what a constructor is and what it does when the class is instantiated',
        'You can trace a method call from the caller through to its return value',
      ],
      'data-transformation': [
        'You understand what map(), filter(), and reduce() each do',
        'You can read a chain of array methods and describe what the output will look like',
        'You can identify when a function is a pure transformation (no side effects) vs one that changes external state',
      ],
      'dependency-injection': [
        'You can explain what a dependency container does',
        'You can read a constructor and identify which parameters are injected',
        'You know where services are registered in this codebase',
      ],
      'reactive-streams': [
        'You understand what an Observable is and how it differs from a Promise',
        'You can read a .pipe() chain and describe what each operator does',
        'You know when to unsubscribe and the consequences of not doing so',
      ],
      'authentication': [
        'You know which mechanism validates identity (JWT, session, etc.)',
        'You can identify which routes require authentication and which are public',
        'You understand what is attached to the request context after authentication',
      ],
      'authorization': [
        'You know whether this codebase uses role-based or policy-based access control',
        'You can trace what role or permission a caller needs for a specific operation',
        'You understand what happens when an authorization check fails',
      ],
      'data-modelling': [
        'You can name the core entities and describe what each represents',
        'You understand the relationships between key entities (one-to-many, etc.)',
        'You know which fields are required and which are optional',
      ],
      'async-patterns': [
        'You can distinguish a synchronous call from an async one in this codebase',
        'You understand what happens when an awaited operation throws',
        'You know how errors propagate across async boundaries',
      ],
      'http-api': [
        'You can list the main endpoints this codebase exposes',
        'You know how request parameters are extracted (query, route, body)',
        'You can trace a request from the route handler through to the response',
      ],
      'state-management': [
        'You understand what state is stored centrally and why',
        'You can trace how a component reads state and how it triggers a change',
        'You know the action/reducer pattern for this state library',
      ],
      'error-handling': [
        'You know where errors are caught and what happens to them',
        'You can identify any silent catch blocks and assess their risk',
        'You understand how errors reach the caller or end user',
      ],
      'testing': [
        'You can run the test suite and see results',
        'You understand what each test file is testing',
        'You can write a basic test for a function you understand',
      ],
      'security-patterns': [
        'You know where credentials and secrets are managed',
        'You can identify which cryptographic patterns are in use',
        'You understand what would need to change to introduce a new secret',
      ],
      'orm-data-access': [
        'You can trace a read operation from service call to database query',
        'You know how the ORM handles transactions',
        'You understand how schema changes are applied (migrations)',
      ],
      'frontend-components': [
        'You understand the component lifecycle in this framework',
        'You can trace how data flows from parent to child and back via events',
        'You know where to add logic vs where to keep components presentational',
      ],
      'configuration': [
        'You know which environment variables are required to run this system',
        'You understand where configuration is loaded and how it is accessed in code',
        'You know how to change a configuration value without touching source code',
      ],
    };

    return base[key] ?? [
      'You can explain what this concept is in plain English',
      'You can identify where it is used in this codebase',
    ];
  }

  // ── focusFirst builders ────────────────────────────────────────────────────

  _buildFileFocusFirst(session, understanding) {
    const u = understanding ?? {};
    if (u.keyWorkflows?.length > 0) return `Start by understanding what this file is responsible for: ${u.keyWorkflows[0]}.`;
    if (u.keyResponsibilities?.length > 0) return `Start by reading the main responsibility: ${u.keyResponsibilities[0]}.`;
    return 'Read the file from top to bottom and identify what problem it is solving before exploring individual methods.';
  }

  _buildKnowledgeFocusFirst(knowledge, understanding) {
    const u = understanding ?? {};
    if (u.mostImportantWorkflows?.length > 0) {
      return `Start with the most important workflow: ${u.mostImportantWorkflows[0].name}. ${u.mostImportantWorkflows[0].description}`;
    }
    if (u.coreCapabilities?.length > 0) {
      return `Start by understanding what this system is built to do: ${u.coreCapabilities[0].name}. ${u.coreCapabilities[0].description}`;
    }
    if (u.keyResponsibilities?.length > 0) {
      return `Start with the primary responsibility: ${u.keyResponsibilities[0]}.`;
    }
    return 'Start by understanding the system\'s purpose before looking at any specific files.';
  }

  // ── Welcome summary builders ───────────────────────────────────────────────

  _buildFileWelcomeSummary(session, understanding, systemType) {
    const purpose = understanding?.businessPurpose || understanding?.executiveSummary || '';
    return `This is ${systemType}. ${purpose}`.trim();
  }

  _buildKnowledgeWelcomeSummary(knowledge, understanding, systemType, systemName) {
    const fileCount = knowledge?.sourceFiles?.length ?? 0;
    const purpose = understanding?.businessPurpose || understanding?.executiveSummary || '';
    const sizeDesc = fileCount > 100 ? 'a large' : fileCount > 30 ? 'a medium-sized' : 'a small';
    return `${systemName} is ${systemType} — ${sizeDesc} codebase with ${fileCount} source files. ${purpose}`.trim();
  }

  // ── Concept title map ──────────────────────────────────────────────────────

  _conceptTitle(key) {
    const titles = {
      'oop-design':             'Object-Oriented Programming',
      'data-transformation':    'Data Transformation Patterns',
      'dependency-injection':   'Dependency Injection',
      'reactive-streams':       'Reactive Streams & Observables',
      'authentication':         'Authentication',
      'authorization':          'Authorization & Access Control',
      'data-modelling':         'Data Modelling',
      'async-patterns':         'Asynchronous Patterns',
      'http-api':               'HTTP API Design',
      'state-management':       'State Management',
      'error-handling':         'Error Handling',
      'testing':                'Automated Testing',
      'security-patterns':      'Security Patterns',
      'orm-data-access':        'ORM & Data Access',
      'frontend-components':    'Frontend Component Architecture',
      'configuration':          'Configuration & Environment',
    };
    return titles[key] ?? key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

module.exports = { LearningConceptEngine };
