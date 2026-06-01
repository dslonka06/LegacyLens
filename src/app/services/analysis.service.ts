import { Injectable } from '@angular/core';
import { AnalysisResult } from '../models/analysis-result.model';
import { RiskItem } from '../models/risk-item.model';
import { ModernizationItem } from '../models/modernization-item.model';

@Injectable({ providedIn: 'root' })
export class AnalysisService {

  analyze(code: string): AnalysisResult {
    const lineCount = code.split('\n').filter(l => l.trim().length > 0).length;
    const complexity = this.getComplexity(lineCount);
    return this.buildAnalysis(code, complexity);
  }

  private getComplexity(lineCount: number): string {
    if (lineCount >= 75) return 'High';
    if (lineCount >= 30) return 'Medium';
    return 'Low';
  }

  private buildAnalysis(code: string, complexity: string): AnalysisResult {
    if (code.includes('[ApiController]') || (code.includes('Controller') && code.includes('class'))) {
      return {
        language: 'C#',
        type: 'API Controller',
        complexity,
        maintainability: 'Medium',
        summary: 'This is an ASP.NET Web API controller responsible for handling HTTP requests and routing them to appropriate business logic.',
        businessPurpose: 'Exposes application functionality as HTTP endpoints, enabling client applications to interact with the system over the web.',
        simplifiedExplanation: 'Think of this as a traffic officer for web requests — it receives requests from the outside world, figures out what to do with them, and sends back responses.',
        risks: [
          { description: 'Endpoint input validation should be reviewed', severity: 'high' },
          { description: 'Authorization requirements may not be fully enforced', severity: 'medium' },
          { description: 'Error responses may expose internal details', severity: 'medium' }
        ],
        modernizationSuggestions: [
          { description: 'Add request validation using FluentValidation or data annotations', priority: 'high' },
          { description: 'Implement global exception handling middleware', priority: 'medium' },
          { description: 'Add API versioning support', priority: 'low' }
        ],
        dataFlow: 'HTTP Request → Controller Action → Service Layer → Repository → Database → Response',
        architecture: 'Follows MVC controller pattern in an ASP.NET Web API application. Controllers should remain thin, delegating business logic to services.',
        security: 'Review authorization attributes on each endpoint. Ensure HTTPS is enforced. Validate and sanitize all input parameters to prevent injection attacks.'
      };
    }

    if (code.includes('Repository') && !code.includes('export class')) {
      return {
        language: 'C#',
        type: 'Repository',
        complexity,
        maintainability: 'Medium',
        summary: 'This is a repository class responsible for abstracting database access operations.',
        businessPurpose: 'Provides a clean data access layer that separates database concerns from business logic.',
        simplifiedExplanation: 'This is like a librarian — it knows how to fetch, store, and find things in the database so the rest of the application does not need to.',
        risks: [
          { description: 'Potential N+1 query performance issues', severity: 'medium' },
          { description: 'Missing async/await patterns may block threads', severity: 'medium' }
        ],
        modernizationSuggestions: [
          { description: 'Add caching layer for frequently accessed data', priority: 'medium' },
          { description: 'Ensure all database operations are async', priority: 'high' },
          { description: 'Review query performance with execution plans', priority: 'medium' }
        ],
        dataFlow: 'Service Layer → Repository → Entity Framework / ADO.NET → Database',
        architecture: 'Implements the Repository pattern, providing abstraction over the data source. Should depend on an interface to support testability.',
        security: 'Ensure parameterized queries are used throughout to prevent SQL injection. Avoid logging sensitive data retrieved from the database.'
      };
    }

    if (code.includes('interface ') && !code.includes('export class')) {
      return {
        language: 'C#',
        type: 'Interface',
        complexity: 'Low',
        maintainability: 'High',
        summary: 'This file defines a contract (interface) that other classes must implement.',
        businessPurpose: 'Defines the expected behavior for a component, enabling dependency injection and loose coupling.',
        simplifiedExplanation: 'Think of this as a job description — it says what methods must exist, but not how they work. Any class that wants to fill the role must implement all the listed methods.',
        risks: [
          { description: 'Interface changes are breaking changes for all implementations', severity: 'low' }
        ],
        modernizationSuggestions: [
          { description: 'Keep interfaces small and focused (Interface Segregation Principle)', priority: 'medium' }
        ],
        dataFlow: 'No direct data flow — this is a contract definition.',
        architecture: 'Part of the dependency inversion layer. Consumers should depend on this interface rather than concrete implementations.',
        security: 'No direct security implications — review implementations for security concerns.'
      };
    }

    if (code.includes('@Component')) {
      return {
        language: 'TypeScript',
        type: 'Angular Component',
        complexity,
        maintainability: 'Medium',
        summary: 'This is an Angular component responsible for a section of the user interface and its associated behavior.',
        businessPurpose: 'Renders UI and manages user interaction for a specific feature or view within the application.',
        simplifiedExplanation: 'This is one building block of the web page — it controls what the user sees and what happens when they click things.',
        risks: [
          { description: 'Business logic mixed into the component may reduce testability', severity: 'medium' },
          { description: 'Component may grow too large without proper decomposition', severity: 'low' }
        ],
        modernizationSuggestions: [
          { description: 'Move business logic into dedicated services', priority: 'high' },
          { description: 'Consider using Angular signals for reactive state', priority: 'medium' },
          { description: 'Break large templates into smaller child components', priority: 'low' }
        ],
        dataFlow: 'Parent Component → @Input() → Component Logic → Template Rendering / @Output() → Parent',
        architecture: 'Angular standalone component. Should focus on presentation and delegate data operations to injected services.',
        security: 'Avoid using innerHTML or bypassSecurityTrust methods. Ensure user-provided content is sanitized before display.'
      };
    }

    if (code.includes('export class') && (code.includes('Service') || code.includes('service'))) {
      return {
        language: 'TypeScript',
        type: 'Angular Service',
        complexity,
        maintainability: 'Medium',
        summary: 'This is an Angular service containing business logic and shared state.',
        businessPurpose: 'Centralizes business logic and data access, making it reusable across multiple components.',
        simplifiedExplanation: 'This is the brain behind the scenes — components ask it for data and it handles the work of fetching or calculating it.',
        risks: [
          { description: 'Stateful services may cause unexpected behavior if not properly managed', severity: 'medium' }
        ],
        modernizationSuggestions: [
          { description: 'Use RxJS Observables or Angular signals for reactive data', priority: 'medium' },
          { description: 'Ensure the service is provided at the correct scope', priority: 'low' }
        ],
        dataFlow: 'Component → Service Method → HTTP / localStorage / Computation → Observable / Result → Component',
        architecture: 'Injectable Angular service. Singleton by default when provided in root. Encapsulates all non-UI logic.',
        security: 'Do not store sensitive tokens in memory longer than necessary. Validate all data before processing.'
      };
    }

    if (code.includes('export class')) {
      return {
        language: 'TypeScript',
        type: 'TypeScript Class',
        complexity,
        maintainability: 'Medium',
        summary: 'This is a TypeScript class encapsulating related logic and state.',
        businessPurpose: 'Groups related functionality into a reusable, organized unit.',
        simplifiedExplanation: 'This is a blueprint — it defines a type of object with its own properties and capabilities.',
        risks: [
          { description: 'Separation of concerns should be reviewed', severity: 'low' }
        ],
        modernizationSuggestions: [
          { description: 'Review adherence to single responsibility principle', priority: 'medium' }
        ],
        dataFlow: 'Depends on usage context — no specific data flow pattern detected.',
        architecture: 'TypeScript class. Ensure it follows SOLID principles.',
        security: 'Review for any direct DOM manipulation or unsafe operations.'
      };
    }

    if (!code.includes('export class') && code.includes('class') && code.includes('Service')) {
      return {
        language: 'C#',
        type: 'Service Class',
        complexity,
        maintainability: 'Medium',
        summary: 'This is a service class responsible for application business logic.',
        businessPurpose: 'Orchestrates business operations and coordinates between repositories and other services.',
        simplifiedExplanation: 'This is the manager of the application — it knows how to coordinate different tasks and make decisions based on business rules.',
        risks: [
          { description: 'No error handling detected', severity: 'high' },
          { description: 'Missing logging may make debugging difficult', severity: 'medium' }
        ],
        modernizationSuggestions: [
          { description: 'Add structured logging using ILogger', priority: 'high' },
          { description: 'Ensure dependency injection is used for all dependencies', priority: 'medium' }
        ],
        dataFlow: 'Controller → Service → Repository → Database',
        architecture: 'Business logic layer service. Should coordinate repositories and other services without direct database access.',
        security: 'Validate all inputs before processing. Ensure proper error handling to avoid leaking implementation details.'
      };
    }

    if (code.includes('[HttpGet]') || code.includes('[HttpPost]') || code.includes('[HttpPut]') || code.includes('[HttpDelete]')) {
      return {
        language: 'C#',
        type: 'API Endpoint',
        complexity,
        maintainability: 'Medium',
        summary: 'This code defines one or more HTTP API endpoints.',
        businessPurpose: 'Provides specific HTTP operations that client applications can call to interact with the system.',
        simplifiedExplanation: 'These are the doors into the application — each one responds to a specific web request.',
        risks: [
          { description: 'Input validation should be verified on all endpoints', severity: 'high' },
          { description: 'Authentication and authorization must be confirmed', severity: 'high' }
        ],
        modernizationSuggestions: [
          { description: 'Review HTTP status code handling for all scenarios', priority: 'high' },
          { description: 'Add rate limiting to prevent abuse', priority: 'medium' }
        ],
        dataFlow: 'HTTP Request → Endpoint → Validation → Handler → Response',
        architecture: 'Minimal API or controller-based endpoint definition.',
        security: 'Every endpoint must have appropriate authorization. Validate and sanitize all request parameters.'
      };
    }

    if (code.toUpperCase().includes('SELECT')) {
      return {
        language: 'SQL',
        type: 'Database Query',
        complexity,
        maintainability: 'High',
        summary: 'This is a SQL query that retrieves data from a database.',
        businessPurpose: 'Fetches the data required to support a specific business operation or report.',
        simplifiedExplanation: 'This is a question asked to the database — it describes exactly what data we want and how to find it.',
        risks: [
          { description: 'SELECT * may retrieve unnecessary columns, impacting performance', severity: 'medium' },
          { description: 'Missing indexes may cause full table scans', severity: 'high' }
        ],
        modernizationSuggestions: [
          { description: 'Replace SELECT * with explicit column lists', priority: 'high' },
          { description: 'Review and add appropriate indexes', priority: 'high' },
          { description: 'Consider query result caching for expensive operations', priority: 'medium' }
        ],
        dataFlow: 'Application → SQL Query → Database Engine → Result Set → Application',
        architecture: 'Raw SQL query. Consider whether an ORM abstraction would improve maintainability.',
        security: 'Ensure this query is never built through string concatenation — use parameterized queries to prevent SQL injection.'
      };
    }

    return {
      language: 'Unknown',
      type: 'Unknown',
      complexity: 'Unknown',
      maintainability: 'Unknown',
      summary: 'LegacyLens could not identify the code type. Try pasting code with recognizable patterns.',
      businessPurpose: 'Unable to determine business purpose from the provided code.',
      simplifiedExplanation: 'The code pattern was not recognized. Try providing C#, TypeScript, or SQL code.',
      risks: [],
      modernizationSuggestions: [],
      dataFlow: 'Unable to determine data flow.',
      architecture: 'Unable to determine architecture.',
      security: 'Unable to perform security analysis.'
    };
  }
}
