// Types from: @app/analysis/models/analysis-result.model
// Types from: @app/analysis/models/risk-item.model
// Types from: @app/analysis/models/modernization-item.model

export interface RiskItem {
  description: string;
  severity: string;
}

export interface ModernizationItem {
  description: string;
  priority: string;
}

export interface AnalysisResult {
  language: string;
  type: string;
  complexity: string;
  maintainability: string;
  summary: string;
  businessPurpose: string;
  simplifiedExplanation: string;
  howItWorks: string;
  whyItExists: string;
  whatToLearnFirst: string[];
  commonMistakes: string[];
  suggestedNextFiles: string[];
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  developerNotes: string;
  architecture: string;
  architectureLayers: string[];
  patterns: string[];
  dataFlow: string;
  risks: RiskItem[];
  modernizationSuggestions: ModernizationItem[];
  security: string;
}

export class AnalysisEngine {

  analyze(code: string): AnalysisResult {
    const lineCount = code.split('\n').filter(l => l.trim().length > 0).length;
    const complexity = this.complexity(lineCount);
    return this.classify(code, complexity);
  }

  private complexity(lines: number): string {
    if (lines >= 75) return 'High';
    if (lines >= 30) return 'Medium';
    return 'Low';
  }

  private classify(code: string, complexity: string): AnalysisResult {
    if (code.includes('[ApiController]') || (code.includes('Controller') && code.includes('class'))) {
      return {
        language: 'C#', type: 'API Controller', complexity, maintainability: 'Medium',
        summary: 'This is an ASP.NET Web API controller responsible for handling HTTP requests, routing them to the appropriate business logic, and returning structured responses.',
        businessPurpose: 'Exposes application functionality as HTTP endpoints, enabling client applications — browsers, mobile apps, or other services — to interact with the system over the web.',
        simplifiedExplanation: 'Think of this as a traffic officer for web requests. It receives a request from the outside world, checks what kind of request it is, hands it off to the right department, then sends a response back.',
        howItWorks: 'Each public method in this class is mapped to an HTTP route (e.g. GET /api/orders). When a request arrives, ASP.NET matches the URL and HTTP method to the correct action method, which calls into a service layer and returns a result.',
        whyItExists: 'Web applications need a well-defined entry point for incoming requests. Controllers provide that boundary — they separate the HTTP protocol concerns from the business logic that sits behind them.',
        whatToLearnFirst: ['HTTP verbs: GET, POST, PUT, DELETE', 'ASP.NET routing and attributes', 'Dependency injection in .NET', 'How ActionResult / IActionResult works'],
        commonMistakes: ['Putting business logic directly in the controller instead of a service', 'Not validating input before processing', 'Returning incorrect HTTP status codes', 'Missing authorization attributes on sensitive endpoints'],
        suggestedNextFiles: ['The corresponding Service class', 'The Request/Response DTO models', 'The startup/program.cs for route configuration'],
        responsibilities: ['Accept and parse HTTP requests', 'Validate input data', 'Delegate processing to the service layer', 'Return appropriate HTTP responses', 'Handle error cases gracefully'],
        inputs: ['HTTP request body (JSON/form data)', 'Route parameters (e.g. /api/orders/{id})', 'Query string parameters', 'Request headers (e.g. Authorization)'],
        outputs: ['HTTP response with status code', 'JSON response body', 'Error messages on failure'],
        dependencies: ['Service layer (business logic)', 'ILogger for structured logging', 'IMapper for DTO mapping', 'Authentication/authorization middleware'],
        developerNotes: 'Keep controllers thin — they should only handle HTTP concerns. Move all business logic into services. Always validate input and use proper HTTP status codes. Add [Authorize] attributes where needed.',
        architecture: 'Follows the MVC controller pattern in an ASP.NET Web API application. The controller sits at the boundary between the HTTP layer and the business logic layer.',
        architectureLayers: ['HTTP / API Layer', 'Controller', 'Service Layer', 'Repository / Data Access', 'Database'],
        patterns: ['MVC', 'Dependency Injection', 'Repository Pattern', 'DTO Pattern'],
        dataFlow: 'HTTP Request → Routing → Controller Action → Input Validation → Service Layer → Repository → Database → Service Result → Controller Response → HTTP Response',
        risks: [
          { description: 'Input validation may be missing or incomplete', severity: 'high' },
          { description: 'Authorization attributes may not be applied to all endpoints', severity: 'high' },
          { description: 'Error responses may expose internal implementation details', severity: 'medium' },
          { description: 'No rate limiting detected', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Add request validation using FluentValidation or data annotations', priority: 'high' },
          { description: 'Implement global exception handling middleware', priority: 'high' },
          { description: 'Add API versioning support', priority: 'medium' },
          { description: 'Add structured logging with correlation IDs', priority: 'medium' },
          { description: 'Consider adding rate limiting middleware', priority: 'low' },
        ],
        security: 'Review all endpoints for proper [Authorize] attributes. Validate and sanitize every input parameter. Return generic error messages to callers — never expose stack traces. Enforce HTTPS. Consider adding CORS policy configuration.',
      };
    }

    if (code.includes('Repository') && !code.includes('export class')) {
      return {
        language: 'C#', type: 'Repository', complexity, maintainability: 'Medium',
        summary: 'This is a repository class responsible for abstracting all database access operations for a specific entity or aggregate.',
        businessPurpose: 'Provides a clean data access layer that separates database concerns from business logic, making the codebase easier to test and maintain.',
        simplifiedExplanation: 'This is like a librarian for the database. Instead of every part of the application knowing how to talk to the database directly, they ask the librarian. The librarian knows exactly how to find, store, update, and delete things.',
        howItWorks: 'The repository wraps database operations (queries, inserts, updates, deletes) behind simple method calls. It typically uses Entity Framework or ADO.NET under the hood. Callers never write SQL directly.',
        whyItExists: 'Direct database access scattered throughout business logic makes code hard to test and change. The repository pattern centralizes data access so it can be swapped, mocked in tests, or optimized independently.',
        whatToLearnFirst: ['Entity Framework Core basics', 'LINQ query syntax', 'What an interface is and why it matters', 'Async/await in C#'],
        commonMistakes: ['Returning EF tracked entities directly to callers (breaks separation of concerns)', 'Not making operations async', 'Performing business logic inside repository methods', 'N+1 query problems from lazy loading'],
        suggestedNextFiles: ['The entity/model class this repository manages', 'The corresponding interface (IXxxRepository)', 'The service that calls this repository', 'DbContext configuration'],
        responsibilities: ['Fetch entities by ID or criteria', 'Persist new entities to the database', 'Update existing entities', 'Delete entities', 'Execute complex queries'],
        inputs: ['Entity IDs', 'Filter/search criteria', 'Entity objects to persist'],
        outputs: ['Entity objects or collections', 'Success/failure indicators', 'Counts or aggregations'],
        dependencies: ['DbContext (Entity Framework)', 'Database connection configuration', 'Entity/model classes'],
        developerNotes: 'Always use async methods to avoid blocking threads. Implement against an interface to support unit testing with mocks. Keep queries in the repository — never let business logic reach into DbContext directly.',
        architecture: 'Implements the Repository pattern. Acts as a mediator between the domain model and the data mapping layers using a collection-like interface for accessing domain objects.',
        architectureLayers: ['Service Layer', 'Repository Interface', 'Repository Implementation', 'Entity Framework / ADO.NET', 'Database'],
        patterns: ['Repository Pattern', 'Dependency Injection', 'Unit of Work'],
        dataFlow: 'Service Layer → Repository Method → LINQ / SQL Query → Entity Framework → Database → Entity Object → Service Layer',
        risks: [
          { description: 'Potential N+1 query performance issues from lazy loading', severity: 'high' },
          { description: 'Missing async patterns may block thread pool threads', severity: 'medium' },
          { description: 'No query result caching for frequently read data', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Ensure all operations use async/await', priority: 'high' },
          { description: 'Add caching layer for frequently accessed data', priority: 'medium' },
          { description: 'Review all queries for N+1 problems', priority: 'medium' },
          { description: 'Add query pagination for large result sets', priority: 'low' },
        ],
        security: 'Ensure parameterized queries are used throughout — Entity Framework handles this automatically, but raw SQL with string concatenation is a SQL injection risk. Never log sensitive data retrieved from the database.',
      };
    }

    if (code.includes('interface ') && !code.includes('export class')) {
      return {
        language: 'C#', type: 'Interface', complexity: 'Low', maintainability: 'High',
        summary: 'This file defines a contract (interface) that specifies the methods and properties any implementing class must provide.',
        businessPurpose: 'Defines the expected behavior for a component without dictating how it works, enabling dependency injection, loose coupling, and testability.',
        simplifiedExplanation: 'This is a job description. It lists every task someone in this role must be able to do — but it does not say how to do them. Any class that wants to fill this role must implement every method listed.',
        howItWorks: 'The interface declares method signatures with no implementation. Classes that implement it are checked by the compiler to ensure they provide all required methods. Consumers depend on the interface, not the concrete class.',
        whyItExists: 'Interfaces allow the rest of the application to work with any class that fulfills the contract — without caring which specific class it is. This makes it easy to swap implementations, write tests with mocks, and keep modules independent.',
        whatToLearnFirst: ['What interfaces are in C#', 'Dependency injection and why it matters', 'How to mock interfaces in unit tests', 'SOLID principles — especially Dependency Inversion'],
        commonMistakes: ['Making interfaces too large (violates Interface Segregation Principle)', 'Adding implementation details to interfaces', 'Creating interfaces for classes that will never have multiple implementations'],
        suggestedNextFiles: ['The class(es) that implement this interface', 'The service or consumer that depends on this interface', 'The dependency injection registration in Startup/Program.cs'],
        responsibilities: ['Define the contract for a specific capability', 'Enable dependency injection and loose coupling', 'Support unit testing through mockable abstractions'],
        inputs: ['N/A — this is a contract definition, not an implementation'],
        outputs: ['N/A — implementations define the actual outputs'],
        dependencies: [],
        developerNotes: 'Keep interfaces focused and small. Follow the Interface Segregation Principle — prefer many small interfaces over one large one. Changing an interface is a breaking change for all implementations.',
        architecture: 'Part of the dependency inversion layer. Consumers depend on this abstraction rather than concrete implementations.',
        architectureLayers: ['Abstraction Layer', 'Contract Definition'],
        patterns: ['Dependency Inversion', 'Interface Segregation', 'Dependency Injection'],
        dataFlow: 'No direct data flow — this is an abstraction definition.',
        risks: [
          { description: 'Interface changes are breaking changes for all implementing classes', severity: 'medium' },
          { description: 'Overly large interfaces violate the Interface Segregation Principle', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Review interface size — split if it has more than 5–7 methods', priority: 'medium' },
          { description: 'Ensure each method has XML documentation comments', priority: 'low' },
        ],
        security: 'No direct security implications. Review all implementing classes for security concerns.',
      };
    }

    if (code.includes('@Component')) {
      return {
        language: 'TypeScript', type: 'Angular Component', complexity, maintainability: 'Medium',
        summary: 'This is an Angular component that manages a portion of the user interface — controlling what the user sees and responding to their interactions.',
        businessPurpose: 'Renders the UI for a specific feature or view within the application and handles user interaction events for that area.',
        simplifiedExplanation: 'This is one building block of the web page. It controls what shows up in a specific area of the screen and what happens when the user clicks buttons, fills in forms, or takes other actions.',
        howItWorks: 'The component class holds data and logic. The HTML template defines the structure. The SCSS defines the styling. Angular connects them — data changes in the class automatically update the template, and user events in the template call methods in the class.',
        whyItExists: 'Angular applications are built by composing components. Each component owns a piece of the UI. Keeping them small and focused makes them reusable, testable, and easier to understand.',
        whatToLearnFirst: ['Angular component lifecycle hooks (ngOnInit, ngOnDestroy)', 'Property binding [ ] and event binding ( )', '@Input and @Output decorators', 'Angular template syntax (*ngIf, *ngFor)'],
        commonMistakes: ['Putting business logic in the component instead of a service', 'Making components too large — split into smaller child components', 'Directly mutating @Input properties', 'Not unsubscribing from Observables (memory leaks)'],
        suggestedNextFiles: ['The service(s) this component injects', 'The parent component that uses this one', 'The route that navigates to this component'],
        responsibilities: ['Render the UI for a specific feature', 'Handle user interaction events', 'Delegate data operations to services', 'Pass data to child components via @Input', 'Emit events to parent components via @Output'],
        inputs: ['@Input properties from parent components', 'Injected service data'],
        outputs: ['@Output EventEmitter events to parent', 'Route navigation side effects'],
        dependencies: ['Injected Angular services', 'CommonModule / Angular directives', 'Router for navigation'],
        developerNotes: 'Keep this component focused on presentation. Move all business logic into services. Use OnPush change detection if performance is a concern. Always clean up subscriptions in ngOnDestroy.',
        architecture: 'Angular standalone component. Sits in the presentation layer — receives data, renders it, and emits user interactions upward.',
        architectureLayers: ['Presentation Layer', 'Component', 'Service Layer'],
        patterns: ['Component Pattern', 'Dependency Injection', 'Event-Driven (EventEmitter)', 'Reactive (Observable)'],
        dataFlow: 'Service → Component Property → Template Binding → DOM → User Event → Component Method → Service',
        risks: [
          { description: 'Business logic mixed into component reduces testability', severity: 'medium' },
          { description: 'Observable subscriptions without cleanup cause memory leaks', severity: 'medium' },
          { description: 'Component may grow too large without decomposition', severity: 'low' },
        ],
        modernizationSuggestions: [
          { description: 'Move business logic into dedicated injectable services', priority: 'high' },
          { description: 'Consider using Angular signals for reactive state management', priority: 'medium' },
          { description: 'Break large templates into focused child components', priority: 'low' },
        ],
        security: 'Avoid using innerHTML or any bypassSecurityTrust methods. Never render user-provided content as HTML without sanitization. Angular sanitizes template bindings by default — do not bypass this.',
      };
    }

    if (code.includes('export class') && (code.includes('Service') || code.includes('service'))) {
      return {
        language: 'TypeScript', type: 'Angular Service', complexity, maintainability: 'Medium',
        summary: 'This is an Angular service that encapsulates business logic and shared state, making it available to any component that injects it.',
        businessPurpose: 'Centralizes business logic and data operations, keeping components thin and making functionality reusable across the application.',
        simplifiedExplanation: 'This is the brain behind the scenes. Components ask it for data or to do things on their behalf. It handles the actual work — fetching data, calculating results, maintaining shared state — so components stay simple.',
        howItWorks: 'The service is decorated with @Injectable and provided in the application root, making it a singleton. Components receive it through constructor injection. It exposes methods and optionally Observable streams that components subscribe to.',
        whyItExists: 'Without services, every component would duplicate data-fetching and business logic. Services eliminate duplication and give a single, testable home for non-UI logic.',
        whatToLearnFirst: ['Angular dependency injection', 'RxJS Observables and Subjects', 'The difference between providedIn root vs component scope', 'How to inject services into components'],
        commonMistakes: ['Storing too much mutable state in services (can cause bugs)', 'Not handling Observable errors', 'Creating circular service dependencies', 'Using services as global event buses instead of proper reactive patterns'],
        suggestedNextFiles: ['The components that inject this service', 'The API/HTTP layer this service calls', 'Related models and interfaces'],
        responsibilities: ['Encapsulate business logic', 'Manage shared application state', 'Coordinate API calls and data transformations', 'Provide reactive data streams to components'],
        inputs: ['Method parameters from calling components', 'HTTP responses from APIs', 'LocalStorage / session data'],
        outputs: ['Processed data objects', 'Observable streams', 'State mutations'],
        dependencies: ['HttpClient for API calls', 'Other injected services', 'Angular Router for navigation side effects'],
        developerNotes: 'Services provided in root are singletons — be careful about shared mutable state. Prefer returning Observables over storing results in properties. Write unit tests against services independently from components.',
        architecture: 'Injectable Angular service. Singleton scoped to the application root. Sits in the business logic layer between components and data sources.',
        architectureLayers: ['Component Layer', 'Service Layer', 'HTTP / Data Layer'],
        patterns: ['Dependency Injection', 'Singleton', 'Observable / Reactive'],
        dataFlow: 'Component → Service Method → HTTP / localStorage / Computation → Observable / Resolved Value → Component',
        risks: [
          { description: 'Shared mutable state may cause unexpected behavior', severity: 'medium' },
          { description: 'Missing Observable error handling', severity: 'medium' },
        ],
        modernizationSuggestions: [
          { description: 'Use Angular signals or RxJS BehaviorSubject for reactive state', priority: 'medium' },
          { description: 'Add error handling for all async operations', priority: 'high' },
        ],
        security: 'Do not store sensitive tokens in service properties longer than necessary. Validate all data before processing. Handle HTTP errors without exposing internal details to the UI.',
      };
    }

    if (code.includes('export class')) {
      return {
        language: 'TypeScript', type: 'TypeScript Class', complexity, maintainability: 'Medium',
        summary: 'This is a TypeScript class that groups related state and behavior into a single reusable unit.',
        businessPurpose: 'Organizes related functionality into a cohesive, reusable blueprint that can be instantiated wherever needed.',
        simplifiedExplanation: 'This is a blueprint — it describes a type of object with its own data and capabilities. When you create an instance of this class, you get an object that has all the properties and can do all the things defined here.',
        howItWorks: 'The class defines properties (data) and methods (behavior). TypeScript adds type safety to standard JavaScript classes. Instances are created with the `new` keyword.',
        whyItExists: 'Classes help organize code by grouping together data and the functions that operate on it, making the code more maintainable and self-documenting.',
        whatToLearnFirst: ['TypeScript class syntax', 'Access modifiers (public, private, readonly)', 'Constructors and property initialization', 'TypeScript interfaces vs classes'],
        commonMistakes: ['Putting too many responsibilities in one class', 'Not using readonly for properties that should not change', 'Mixing data models with business logic'],
        suggestedNextFiles: ['Related interfaces or models', 'Classes that use or extend this class'],
        responsibilities: ['Encapsulate related data and behavior', 'Provide a reusable type definition'],
        inputs: ['Constructor parameters'],
        outputs: ['Method return values', 'Property values'],
        dependencies: [],
        developerNotes: 'Review for adherence to the Single Responsibility Principle. Consider whether a plain interface would be more appropriate if no methods are needed.',
        architecture: 'TypeScript class in the application layer. Review placement relative to SOLID principles.',
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
        simplifiedExplanation: 'This is the manager of the application. When a controller receives a request, it delegates the actual work here. This class knows the business rules — what is allowed, what should happen, and in what order.',
        howItWorks: 'The service receives requests from controllers, applies business rules, calls repositories for data access, coordinates with other services if needed, and returns results.',
        whyItExists: 'Separating business logic from the HTTP layer (controllers) and data layer (repositories) keeps each layer focused and independently testable.',
        whatToLearnFirst: ['Dependency injection in .NET', 'The difference between services, repositories, and controllers', 'How to write unit tests for services using mocks', 'C# async/await patterns'],
        commonMistakes: ['Directly accessing the database (should go through a repository)', 'Catching exceptions and silently swallowing them', 'Making services stateful when they should be stateless', 'Not logging important business events'],
        suggestedNextFiles: ['The controller that calls this service', 'The repositories this service depends on', 'The domain models this service operates on'],
        responsibilities: ['Implement business rules and workflows', 'Coordinate between repositories and other services', 'Validate business-level rules', 'Map between domain objects and DTOs'],
        inputs: ['Request objects from controllers', 'Entity objects from repositories'],
        outputs: ['Result objects or DTOs', 'Success/failure responses'],
        dependencies: ['Repository interfaces', 'ILogger for structured logging', 'Other domain services', 'IMapper for object mapping'],
        developerNotes: 'Services should be stateless — do not store request-specific data as class fields. Use constructor injection for all dependencies. Log important business events and exceptions.',
        architecture: 'Business logic layer. Sits between the presentation layer (controllers) and the data layer (repositories).',
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
          { description: 'Ensure all public methods are async', priority: 'medium' },
        ],
        security: 'Validate all inputs at the service boundary. Do not trust data that comes from the controller without validation. Log security-relevant events (failed authorization, suspicious input).',
      };
    }

    if (code.includes('[HttpGet]') || code.includes('[HttpPost]') || code.includes('[HttpPut]') || code.includes('[HttpDelete]')) {
      return {
        language: 'C#', type: 'API Endpoint', complexity, maintainability: 'Medium',
        summary: 'This code defines one or more HTTP API endpoints that accept requests from clients and return structured responses.',
        businessPurpose: 'Exposes specific operations over HTTP, forming the contract between this service and any clients that depend on it.',
        simplifiedExplanation: 'These are the doors into the application. Each door has a label (the URL) and a sign saying what kind of visitor it accepts (GET, POST, etc.). When a client knocks on the right door with the right information, the application responds.',
        howItWorks: 'Each method decorated with [HttpGet], [HttpPost], etc. is mapped to a specific URL route. When a matching HTTP request arrives, ASP.NET calls that method and returns whatever it produces as an HTTP response.',
        whyItExists: 'REST APIs give clients a predictable, stateless way to interact with server-side functionality using standard HTTP conventions.',
        whatToLearnFirst: ['REST conventions (GET = read, POST = create, PUT = update, DELETE = remove)', 'HTTP status codes', 'Route templates and parameters', 'Model binding in ASP.NET'],
        commonMistakes: ['Returning 200 OK for error cases instead of 4xx/5xx', 'Not documenting request/response contracts', 'Missing input validation before processing'],
        suggestedNextFiles: ['The service this endpoint delegates to', 'Request/response DTO classes', 'Authentication/authorization configuration'],
        responsibilities: ['Accept HTTP requests on defined routes', 'Bind and validate request data', 'Call the appropriate service method', 'Return correct HTTP response codes and bodies'],
        inputs: ['HTTP request body', 'Route parameters', 'Query string', 'Headers'],
        outputs: ['HTTP response with status code', 'Response body (JSON)'],
        dependencies: ['Service layer', 'Validation framework', 'Authentication middleware'],
        developerNotes: 'Keep endpoint methods thin. All business logic belongs in services. Always return meaningful HTTP status codes. Document every endpoint for API consumers.',
        architecture: 'HTTP API endpoint definition. Forms the public contract of this service.',
        architectureLayers: ['HTTP / API Layer', 'Input Validation', 'Service Layer'],
        patterns: ['REST', 'MVC', 'Dependency Injection'],
        dataFlow: 'HTTP Request → Route Matching → Model Binding → Validation → Service Call → HTTP Response',
        risks: [
          { description: 'Input validation should be verified on all endpoints', severity: 'high' },
          { description: 'Authentication and authorization must be confirmed', severity: 'high' },
        ],
        modernizationSuggestions: [
          { description: 'Add rate limiting to prevent abuse', priority: 'medium' },
          { description: 'Add API versioning', priority: 'medium' },
          { description: 'Add Swagger/OpenAPI documentation', priority: 'low' },
        ],
        security: 'Every endpoint must have appropriate [Authorize] attributes. Validate and sanitize all request parameters. Return 401/403 for auth failures, not 404 (which leaks information).',
      };
    }

    if (code.toUpperCase().includes('SELECT')) {
      return {
        language: 'SQL', type: 'Database Query', complexity, maintainability: 'High',
        summary: 'This is a SQL query that retrieves, filters, or transforms data from one or more database tables.',
        businessPurpose: 'Fetches precisely the data needed for a business operation, report, or screen — nothing more, nothing less.',
        simplifiedExplanation: 'This is a question asked to the database. It describes exactly what information you want — from which table, filtered by which conditions, sorted in what order — and the database engine figures out the most efficient way to find it.',
        howItWorks: 'The SQL engine parses the query, creates an execution plan, reads data from tables (using indexes where available), applies filters and joins, and returns the matching rows.',
        whyItExists: 'Databases store data efficiently but in a raw form. Queries let you extract exactly what your application needs, in the right shape, without loading everything into memory.',
        whatToLearnFirst: ['SELECT, FROM, WHERE, ORDER BY, GROUP BY', 'JOINs (INNER, LEFT, RIGHT)', 'Indexes and when the database uses them', 'How to read a query execution plan'],
        commonMistakes: ['Using SELECT * instead of specifying needed columns', 'Missing WHERE clauses that cause full table scans', 'Not using parameterized queries (SQL injection risk)', 'Fetching too many rows and filtering in application code'],
        suggestedNextFiles: ['The repository or DAL that executes this query', 'Index definitions on the tables involved', 'Related stored procedures'],
        responsibilities: ['Retrieve data matching specific criteria', 'Join related tables', 'Aggregate or transform results'],
        inputs: ['Filter parameters (ideally parameterized)', 'Pagination parameters (OFFSET, LIMIT)'],
        outputs: ['Result set of matching rows', 'Aggregated values'],
        dependencies: ['Database tables', 'Indexes', 'Views or stored procedures (if referenced)'],
        developerNotes: 'Always use parameterized queries — never concatenate user input into SQL strings. Check the execution plan for expensive full scans. Add indexes on columns used in WHERE and JOIN conditions.',
        architecture: 'Data access layer query. Executes directly against the database.',
        architectureLayers: ['Application / Repository Layer', 'SQL Query', 'Database Engine', 'Storage'],
        patterns: ['Query Object', 'Repository Pattern'],
        dataFlow: 'Application → Parameterized Query → Database Engine → Execution Plan → Index/Table Scan → Result Set → Application',
        risks: [
          { description: 'SELECT * may retrieve unnecessary columns, impacting performance', severity: 'medium' },
          { description: 'Missing indexes may cause full table scans', severity: 'high' },
          { description: 'String concatenation in query construction is a SQL injection risk', severity: 'high' },
        ],
        modernizationSuggestions: [
          { description: 'Replace SELECT * with explicit column names', priority: 'high' },
          { description: 'Add appropriate indexes on WHERE and JOIN columns', priority: 'high' },
          { description: 'Add pagination with OFFSET/FETCH or ROW_NUMBER()', priority: 'medium' },
        ],
        security: 'Always use parameterized queries — never build SQL with string concatenation. Parameterization is the single most important defense against SQL injection. Review table-level permissions for the executing user.',
      };
    }

    return {
      language: 'Unknown', type: 'Unknown', complexity: 'Unknown', maintainability: 'Unknown',
      summary: 'SystemLens could not identify the code type. Try pasting C#, TypeScript, or SQL code with recognizable patterns.',
      businessPurpose: 'Unable to determine business purpose from the provided code.',
      simplifiedExplanation: 'The code pattern was not recognized. SystemLens currently supports C#, TypeScript/Angular, and SQL.',
      howItWorks: 'Unable to determine.',
      whyItExists: 'Unable to determine.',
      whatToLearnFirst: [],
      commonMistakes: [],
      suggestedNextFiles: [],
      responsibilities: [],
      inputs: [],
      outputs: [],
      dependencies: [],
      developerNotes: 'SystemLens could not classify this code. Try providing a cleaner code sample with identifiable patterns.',
      architecture: 'Unable to determine architecture.',
      architectureLayers: [],
      patterns: [],
      dataFlow: 'Unable to determine data flow.',
      risks: [],
      modernizationSuggestions: [],
      security: 'Unable to perform security analysis.',
    };
  }
}
