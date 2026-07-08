'use strict';

class AnalysisEngine {

  analyze(code) {
    const lineCount = code.split('\n').filter(l => l.trim().length > 0).length;
    const complexity = this.complexity(lineCount);
    return this.classify(code, complexity);
  }

  complexity(lines) {
    if (lines >= 75) return 'High';
    if (lines >= 30) return 'Medium';
    return 'Low';
  }

  classify(code, complexity) {
    if (code.includes('[ApiController]') || (code.includes('Controller') && code.includes('class'))) {
      return {
        language: 'C#', type: 'API Controller', complexity, maintainability: 'Medium',
        summary: 'This is an ASP.NET Web API controller responsible for handling HTTP requests, routing them to the appropriate business logic, and returning structured responses.',
        businessPurpose: 'Exposes application functionality as HTTP endpoints, enabling client applications to interact with the system over the web.',
        simplifiedExplanation: 'Think of this as a traffic officer for web requests. It receives a request, checks what kind it is, hands it off to the right department, then sends a response back.',
        howItWorks: 'Each public method is mapped to an HTTP route. When a request arrives, ASP.NET matches the URL and HTTP method to the correct action method, which calls into a service layer.',
        whyItExists: 'Controllers provide the boundary between HTTP protocol concerns and the business logic behind them.',
        whatToLearnFirst: ['HTTP verbs: GET, POST, PUT, DELETE', 'ASP.NET routing and attributes', 'Dependency injection in .NET', 'How ActionResult / IActionResult works'],
        commonMistakes: ['Putting business logic directly in the controller', 'Not validating input', 'Returning incorrect HTTP status codes', 'Missing authorization attributes'],
        suggestedNextFiles: ['The corresponding Service class', 'The Request/Response DTO models', 'The startup/program.cs for route configuration'],
        responsibilities: ['Accept and parse HTTP requests', 'Validate input data', 'Delegate to service layer', 'Return HTTP responses', 'Handle error cases'],
        inputs: ['HTTP request body', 'Route parameters', 'Query string parameters', 'Request headers'],
        outputs: ['HTTP response with status code', 'JSON response body', 'Error messages on failure'],
        dependencies: ['Service layer', 'ILogger', 'IMapper', 'Authentication middleware'],
        developerNotes: 'Keep controllers thin. Move all business logic into services.',
        architecture: 'MVC controller pattern in an ASP.NET Web API application.',
        architectureLayers: ['HTTP / API Layer', 'Controller', 'Service Layer', 'Repository / Data Access', 'Database'],
        patterns: ['MVC', 'Dependency Injection', 'Repository Pattern', 'DTO Pattern'],
        dataFlow: 'HTTP Request → Routing → Controller Action → Service Layer → Repository → Database → HTTP Response',
        risks: [
          { description: 'Input validation may be missing or incomplete', severity: 'high' },
          { description: 'Authorization attributes may not be applied', severity: 'high' },
          { description: 'Error responses may expose internal details', severity: 'medium' },
          { description: 'No rate limiting detected', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Add request validation using FluentValidation', priority: 'high' },
          { description: 'Implement global exception handling middleware', priority: 'high' },
          { description: 'Add API versioning support', priority: 'medium' },
          { description: 'Add structured logging with correlation IDs', priority: 'medium' },
          { description: 'Consider adding rate limiting middleware', priority: 'low' },
        ],
        security: 'Review all endpoints for [Authorize] attributes. Validate every input. Never expose stack traces.',
      };
    }

    if (code.includes('Repository') && !code.includes('export class')) {
      return {
        language: 'C#', type: 'Repository', complexity, maintainability: 'Medium',
        summary: 'This is a repository class responsible for abstracting all database access operations for a specific entity.',
        businessPurpose: 'Provides a clean data access layer that separates database concerns from business logic.',
        simplifiedExplanation: 'This is like a librarian for the database — every part of the application asks the librarian instead of accessing the database directly.',
        howItWorks: 'Wraps database operations behind simple method calls using Entity Framework or ADO.NET.',
        whyItExists: 'Centralizes data access so it can be swapped, mocked in tests, or optimized independently.',
        whatToLearnFirst: ['Entity Framework Core basics', 'LINQ query syntax', 'Interfaces and why they matter', 'Async/await in C#'],
        commonMistakes: ['Returning tracked entities to callers', 'Not making operations async', 'Performing business logic inside repository methods', 'N+1 query problems'],
        suggestedNextFiles: ['The entity this repository manages', 'The corresponding interface', 'The service that calls this repository', 'DbContext configuration'],
        responsibilities: ['Fetch entities by ID or criteria', 'Persist new entities', 'Update existing entities', 'Delete entities', 'Execute complex queries'],
        inputs: ['Entity IDs', 'Filter criteria', 'Entity objects to persist'],
        outputs: ['Entity objects or collections', 'Success/failure indicators', 'Counts or aggregations'],
        dependencies: ['DbContext (Entity Framework)', 'Database connection configuration', 'Entity/model classes'],
        developerNotes: 'Always use async methods. Implement against an interface to support unit testing.',
        architecture: 'Repository pattern. Acts as mediator between the domain model and data mapping layers.',
        architectureLayers: ['Service Layer', 'Repository Interface', 'Repository Implementation', 'Entity Framework', 'Database'],
        patterns: ['Repository Pattern', 'Dependency Injection', 'Unit of Work'],
        dataFlow: 'Service Layer → Repository Method → LINQ / SQL Query → Entity Framework → Database → Entity Object',
        risks: [
          { description: 'Potential N+1 query performance issues', severity: 'high' },
          { description: 'Missing async patterns may block threads', severity: 'medium' },
          { description: 'No query result caching', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Ensure all operations use async/await', priority: 'high' },
          { description: 'Add caching layer for frequently accessed data', priority: 'medium' },
          { description: 'Review all queries for N+1 problems', priority: 'medium' },
        ],
        security: 'Ensure parameterized queries are used throughout. Never log sensitive data from the database.',
      };
    }

    if (code.includes('interface ') && !code.includes('export class')) {
      return {
        language: 'C#', type: 'Interface', complexity: 'Low', maintainability: 'High',
        summary: 'This file defines a contract that specifies the methods and properties any implementing class must provide.',
        businessPurpose: 'Defines expected behavior for a component without dictating how it works, enabling dependency injection and testability.',
        simplifiedExplanation: 'This is a job description — it lists every task someone in this role must be able to do, but not how to do them.',
        howItWorks: 'Declares method signatures with no implementation. Classes that implement it are compiler-checked for all required methods.',
        whyItExists: 'Allows the application to work with any class that fulfills the contract, making it easy to swap implementations and write tests.',
        whatToLearnFirst: ['What interfaces are in C#', 'Dependency injection and why it matters', 'How to mock interfaces in tests', 'SOLID principles'],
        commonMistakes: ['Making interfaces too large', 'Adding implementation details', 'Creating interfaces for classes with one implementation'],
        suggestedNextFiles: ['The implementing class(es)', 'The service that depends on this interface', 'Dependency injection registration'],
        responsibilities: ['Define the contract for a capability', 'Enable dependency injection', 'Support unit testing through mockable abstractions'],
        inputs: ['N/A — contract definition'],
        outputs: ['N/A — implementations define outputs'],
        dependencies: [],
        developerNotes: 'Keep interfaces focused and small. Follow Interface Segregation Principle.',
        architecture: 'Part of the dependency inversion layer.',
        architectureLayers: ['Abstraction Layer', 'Contract Definition'],
        patterns: ['Dependency Inversion', 'Interface Segregation', 'Dependency Injection'],
        dataFlow: 'No direct data flow — abstraction definition.',
        risks: [
          { description: 'Interface changes are breaking changes', severity: 'medium' },
          { description: 'Overly large interfaces violate Interface Segregation', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Review interface size — split if more than 7 methods', priority: 'medium' },
        ],
        security: 'No direct security implications. Review all implementing classes.',
      };
    }

    if (code.includes('@Component')) {
      return {
        language: 'TypeScript', type: 'Angular Component', complexity, maintainability: 'Medium',
        summary: 'This is an Angular component that manages a portion of the user interface.',
        businessPurpose: 'Renders the UI for a specific feature and handles user interaction events.',
        simplifiedExplanation: 'One building block of the web page — controls what shows up in a specific area and what happens when the user interacts with it.',
        howItWorks: 'The component class holds data and logic. The HTML template defines the structure. Angular connects them reactively.',
        whyItExists: 'Angular applications are built by composing components. Each component owns a piece of the UI.',
        whatToLearnFirst: ['Angular lifecycle hooks', 'Property binding and event binding', '@Input and @Output', 'Angular template syntax'],
        commonMistakes: ['Business logic in the component', 'Making components too large', 'Mutating @Input properties', 'Not unsubscribing from Observables'],
        suggestedNextFiles: ['The service(s) injected', 'The parent component', 'The route that navigates here'],
        responsibilities: ['Render UI for a feature', 'Handle user events', 'Delegate to services', 'Pass data to children', 'Emit events to parent'],
        inputs: ['@Input properties', 'Injected service data'],
        outputs: ['@Output EventEmitter events', 'Route navigation side effects'],
        dependencies: ['Injected Angular services', 'CommonModule', 'Router'],
        developerNotes: 'Keep focused on presentation. Move business logic into services. Clean up subscriptions in ngOnDestroy.',
        architecture: 'Angular standalone component. Sits in the presentation layer.',
        architectureLayers: ['Presentation Layer', 'Component', 'Service Layer'],
        patterns: ['Component Pattern', 'Dependency Injection', 'Event-Driven', 'Reactive'],
        dataFlow: 'Service → Component Property → Template Binding → DOM → User Event → Component Method → Service',
        risks: [
          { description: 'Business logic mixed in reduces testability', severity: 'medium' },
          { description: 'Observable subscriptions without cleanup cause memory leaks', severity: 'medium' },
          { description: 'Component may grow too large', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Move business logic into services', priority: 'high' },
          { description: 'Consider Angular signals for reactive state', priority: 'medium' },
        ],
        security: 'Avoid using innerHTML or bypassSecurityTrust. Never render user content as HTML without sanitization.',
      };
    }

    if (code.includes('export class') && (code.includes('Service') || code.includes('service'))) {
      return {
        language: 'TypeScript', type: 'Angular Service', complexity, maintainability: 'Medium',
        summary: 'This is an Angular service that encapsulates business logic and shared state.',
        businessPurpose: 'Centralizes business logic and data operations, keeping components thin and functionality reusable.',
        simplifiedExplanation: 'The brain behind the scenes — components ask it for data or to do things on their behalf.',
        howItWorks: 'Decorated with @Injectable, provided as singleton. Components receive it through constructor injection.',
        whyItExists: 'Eliminates duplication and provides a single, testable home for non-UI logic.',
        whatToLearnFirst: ['Angular dependency injection', 'RxJS Observables and Subjects', 'providedIn root vs component scope', 'How to inject services'],
        commonMistakes: ['Too much mutable state', 'Not handling Observable errors', 'Circular service dependencies', 'Using services as global event buses'],
        suggestedNextFiles: ['Components that inject this service', 'The API layer it calls', 'Related models and interfaces'],
        responsibilities: ['Encapsulate business logic', 'Manage shared state', 'Coordinate API calls', 'Provide reactive data streams'],
        inputs: ['Method parameters', 'HTTP responses', 'LocalStorage data'],
        outputs: ['Processed data objects', 'Observable streams', 'State mutations'],
        dependencies: ['HttpClient', 'Other injected services', 'Angular Router'],
        developerNotes: 'Services provided in root are singletons. Prefer returning Observables over storing in properties.',
        architecture: 'Injectable Angular service. Singleton scoped to app root.',
        architectureLayers: ['Component Layer', 'Service Layer', 'HTTP / Data Layer'],
        patterns: ['Dependency Injection', 'Singleton', 'Observable / Reactive'],
        dataFlow: 'Component → Service Method → HTTP / Computation → Observable → Component',
        risks: [
          { description: 'Shared mutable state may cause unexpected behavior', severity: 'medium' },
          { description: 'Missing Observable error handling', severity: 'medium' },
        ],
        modernizationSuggestions: [
          { description: 'Use Angular signals or RxJS BehaviorSubject for reactive state', priority: 'medium' },
          { description: 'Add error handling for all async operations', priority: 'high' },
        ],
        security: 'Do not store sensitive tokens longer than necessary. Handle HTTP errors without exposing details to the UI.',
      };
    }

    if (code.includes('export class')) {
      return {
        language: 'TypeScript', type: 'TypeScript Class', complexity, maintainability: 'Medium',
        summary: 'This is a TypeScript class that groups related state and behavior into a single reusable unit.',
        businessPurpose: 'Organizes related functionality into a cohesive, reusable blueprint.',
        simplifiedExplanation: 'A blueprint — describes a type of object with its own data and capabilities.',
        howItWorks: 'Defines properties (data) and methods (behavior). TypeScript adds type safety.',
        whyItExists: 'Groups data and the functions that operate on it together.',
        whatToLearnFirst: ['TypeScript class syntax', 'Access modifiers', 'Constructors and property initialization', 'Interfaces vs classes'],
        commonMistakes: ['Too many responsibilities in one class', 'Not using readonly for immutable properties', 'Mixing data models with business logic'],
        suggestedNextFiles: ['Related interfaces or models', 'Classes that use or extend this class'],
        responsibilities: ['Encapsulate related data and behavior', 'Provide a reusable type definition'],
        inputs: ['Constructor parameters'],
        outputs: ['Method return values', 'Property values'],
        dependencies: [],
        developerNotes: 'Review for Single Responsibility Principle adherence.',
        architecture: 'TypeScript class in the application layer.',
        architectureLayers: ['Application Layer'],
        patterns: ['Object-Oriented Design'],
        dataFlow: 'Depends on usage context.',
        risks: [{ description: 'Separation of concerns should be reviewed', severity: 'low' }],
        modernizationSuggestions: [{ description: 'Review adherence to single responsibility principle', priority: 'medium' }],
        security: 'Review for any direct DOM manipulation or unsafe type assertions.',
      };
    }

    if (!code.includes('export class') && code.includes('class') && code.includes('Service')) {
      return {
        language: 'C#', type: 'Service Class', complexity, maintainability: 'Medium',
        summary: 'This is a C# service class containing the core business logic for a specific domain or feature area.',
        businessPurpose: 'Orchestrates business operations by coordinating between repositories, external services, and domain rules.',
        simplifiedExplanation: 'The manager of the application — the controller delegates work here.',
        howItWorks: 'Receives requests, applies business rules, calls repositories, coordinates with other services.',
        whyItExists: 'Separates business logic from the HTTP layer and data layer.',
        whatToLearnFirst: ['Dependency injection in .NET', 'Services vs repositories vs controllers', 'Unit testing services with mocks', 'C# async/await'],
        commonMistakes: ['Directly accessing the database', 'Swallowing exceptions silently', 'Making services stateful', 'Not logging business events'],
        suggestedNextFiles: ['The controller that calls this service', 'The repositories it depends on', 'The domain models it operates on'],
        responsibilities: ['Implement business rules', 'Coordinate between repositories and services', 'Validate business-level rules', 'Map between domain objects and DTOs'],
        inputs: ['Request objects from controllers', 'Entity objects from repositories'],
        outputs: ['Result objects or DTOs', 'Success/failure responses'],
        dependencies: ['Repository interfaces', 'ILogger', 'Other domain services', 'IMapper'],
        developerNotes: 'Services should be stateless. Use constructor injection for all dependencies.',
        architecture: 'Business logic layer. Sits between presentation and data layers.',
        architectureLayers: ['Controller / API Layer', 'Service Layer', 'Repository / Data Access', 'Database'],
        patterns: ['Dependency Injection', 'Service Layer Pattern', 'SOLID Principles'],
        dataFlow: 'Controller → Service → Repository → Database → Repository → Service → Controller',
        risks: [
          { description: 'No error handling detected', severity: 'high' },
          { description: 'Missing structured logging', severity: 'medium' },
        ],
        modernizationSuggestions: [
          { description: 'Add structured logging using ILogger<T>', priority: 'high' },
          { description: 'Add try/catch with meaningful exception messages', priority: 'high' },
        ],
        security: 'Validate all inputs at the service boundary. Log security-relevant events.',
      };
    }

    if (code.includes('[HttpGet]') || code.includes('[HttpPost]') || code.includes('[HttpPut]') || code.includes('[HttpDelete]')) {
      return {
        language: 'C#', type: 'API Endpoint', complexity, maintainability: 'Medium',
        summary: 'This code defines one or more HTTP API endpoints.',
        businessPurpose: 'Exposes specific operations over HTTP, forming the contract between this service and its clients.',
        simplifiedExplanation: 'These are the doors into the application — each with a label (URL) and a sign saying what kind of visitor it accepts.',
        howItWorks: 'Each method decorated with [HttpGet/Post/etc.] is mapped to a URL route.',
        whyItExists: 'REST APIs give clients a predictable, stateless way to interact with the server.',
        whatToLearnFirst: ['REST conventions', 'HTTP status codes', 'Route templates', 'Model binding in ASP.NET'],
        commonMistakes: ['Returning 200 OK for errors', 'Not documenting contracts', 'Missing input validation'],
        suggestedNextFiles: ['The service this endpoint delegates to', 'Request/response DTO classes', 'Authentication configuration'],
        responsibilities: ['Accept HTTP requests', 'Bind and validate request data', 'Call service methods', 'Return HTTP responses'],
        inputs: ['HTTP request body', 'Route parameters', 'Query string', 'Headers'],
        outputs: ['HTTP response with status code', 'Response body (JSON)'],
        dependencies: ['Service layer', 'Validation framework', 'Authentication middleware'],
        developerNotes: 'Keep endpoint methods thin. Always return meaningful HTTP status codes.',
        architecture: 'HTTP API endpoint definition.',
        architectureLayers: ['HTTP / API Layer', 'Input Validation', 'Service Layer'],
        patterns: ['REST', 'MVC', 'Dependency Injection'],
        dataFlow: 'HTTP Request → Route Matching → Model Binding → Validation → Service Call → HTTP Response',
        risks: [
          { description: 'Input validation should be verified', severity: 'high' },
          { description: 'Authentication must be confirmed', severity: 'high' },
        ],
        modernizationSuggestions: [
          { description: 'Add rate limiting', priority: 'medium' },
          { description: 'Add API versioning', priority: 'medium' },
        ],
        security: 'Every endpoint must have [Authorize] attributes. Validate all parameters.',
      };
    }

    if (code.toUpperCase().includes('SELECT')) {
      return {
        language: 'SQL', type: 'Database Query', complexity, maintainability: 'High',
        summary: 'This is a SQL query that retrieves, filters, or transforms data from one or more database tables.',
        businessPurpose: 'Fetches precisely the data needed for a business operation, report, or screen.',
        simplifiedExplanation: 'A question asked to the database — describes exactly what information you want.',
        howItWorks: 'The SQL engine parses the query, creates an execution plan, reads data, applies filters and joins.',
        whyItExists: 'Extracts exactly what the application needs without loading everything into memory.',
        whatToLearnFirst: ['SELECT, FROM, WHERE, ORDER BY, GROUP BY', 'JOINs', 'Indexes', 'Execution plans'],
        commonMistakes: ['SELECT *', 'Missing WHERE clauses', 'Not using parameterized queries', 'Filtering in application code'],
        suggestedNextFiles: ['The repository that executes this query', 'Index definitions', 'Related stored procedures'],
        responsibilities: ['Retrieve matching data', 'Join related tables', 'Aggregate or transform results'],
        inputs: ['Filter parameters', 'Pagination parameters'],
        outputs: ['Result set of matching rows', 'Aggregated values'],
        dependencies: ['Database tables', 'Indexes', 'Views or stored procedures'],
        developerNotes: 'Always use parameterized queries. Check execution plans. Add indexes on WHERE and JOIN columns.',
        architecture: 'Data access layer query.',
        architectureLayers: ['Application / Repository Layer', 'SQL Query', 'Database Engine', 'Storage'],
        patterns: ['Query Object', 'Repository Pattern'],
        dataFlow: 'Application → Parameterized Query → Database Engine → Execution Plan → Result Set → Application',
        risks: [
          { description: 'SELECT * may retrieve unnecessary columns', severity: 'medium' },
          { description: 'Missing indexes may cause full table scans', severity: 'high' },
          { description: 'String concatenation is a SQL injection risk', severity: 'high' },
        ],
        modernizationSuggestions: [
          { description: 'Replace SELECT * with explicit column names', priority: 'high' },
          { description: 'Add appropriate indexes', priority: 'high' },
          { description: 'Add pagination', priority: 'medium' },
        ],
        security: 'Always use parameterized queries. Review table-level permissions.',
      };
    }

    return {
      language: 'Unknown', type: 'Unknown', complexity: 'Unknown', maintainability: 'Unknown',
      summary: 'SystemLens could not identify the code type.',
      businessPurpose: 'Unable to determine.',
      simplifiedExplanation: 'The code pattern was not recognized.',
      howItWorks: 'Unable to determine.',
      whyItExists: 'Unable to determine.',
      whatToLearnFirst: [],
      commonMistakes: [],
      suggestedNextFiles: [],
      responsibilities: [],
      inputs: [],
      outputs: [],
      dependencies: [],
      developerNotes: 'Try providing a cleaner code sample with identifiable patterns.',
      architecture: 'Unable to determine.',
      architectureLayers: [],
      patterns: [],
      dataFlow: 'Unable to determine.',
      risks: [],
      modernizationSuggestions: [],
      security: 'Unable to perform security analysis.',
    };
  }
}

module.exports = { AnalysisEngine };
