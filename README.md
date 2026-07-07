# SystemLens

SystemLens is a codebase analysis and developer onboarding platform designed to help engineers understand unfamiliar software systems faster.

The project analyzes files, folders, and repositories and transforms them into structured knowledge that helps developers understand architecture, workflows, dependencies, and business logic. SystemLens was created to reduce the learning curve associated with large or legacy codebases and provide a clearer path for onboarding, maintenance, and modernization efforts.

---

## Why SystemLens?

Developers often inherit systems with thousands of files, limited documentation, and years of accumulated technical decisions. Understanding how these systems work can take days or weeks.

SystemLens helps bridge that gap by providing:

* Repository analysis and technology discovery
* AI-generated system explanations and summaries
* Architecture and dependency exploration
* Data flow and workflow analysis
* Guided onboarding and learning paths
* Documentation and knowledge-sharing generation

The goal is simple: help developers spend less time figuring out a codebase and more time contributing to it.

---

## Current Capabilities

### Repository Analysis

* Analyze files, folders, and complete repositories
* Discover technologies, frameworks, and project structures
* Identify dependencies and architectural patterns

### System Understanding

* Generate repository summaries and system explanations
* Highlight key components, services, and workflows
* Surface important areas of the codebase for investigation

### Architecture & Data Flow Exploration

* Explore relationships between components and services
* Understand how data moves throughout the application
* Visualize system structure and interactions

### Developer Onboarding

* Generate learning paths for new developers
* Identify important files and concepts to review first
* Accelerate ramp-up time on unfamiliar projects

### Documentation Generation

* Create documentation from repository analysis
* Consolidate repository knowledge into shareable formats

---

## Future Vision

SystemLens is being developed into a desktop-first platform capable of running with local AI models and supporting significantly larger repositories.

Future development areas include:

* Desktop application support
* Local AI integration (Claude and other providers)
* Multi-model analysis pipelines
* Improved analysis performance and scalability
* Enhanced architecture and dependency intelligence
* Deeper workflow and repository understanding
* Improved verification and accuracy through multiple AI models

By leveraging multiple AI models together, SystemLens aims to increase the accuracy, consistency, and validation of generated insights while providing richer repository intelligence.

---

## Technology Stack

### Frontend

* Angular 21
* TypeScript
* SCSS
* Angular Material
* Monaco Editor

### Analysis Platform

* Repository discovery
* Dependency analysis
* Architecture analysis
* Data flow analysis
* AI-powered repository intelligence

---

# Development

This project was generated using Angular CLI version 21.2.13.

## Development Server

Start a local development server:

```bash
ng serve
```

Once the server is running, open your browser and navigate to:

```text
http://localhost:4200
```

The application will automatically reload when source files are modified.

---

## Code Scaffolding

Generate a new component:

```bash
ng generate component component-name
```

For a complete list of available schematics:

```bash
ng generate --help
```

---

## Building

Build the project:

```bash
ng build
```

Build artifacts will be generated in the `dist/` directory.

Production builds are optimized for performance and deployment.

---

## Running Unit Tests

Execute unit tests using Vitest:

```bash
ng test
```

---

## Running End-to-End Tests

Execute end-to-end tests:

```bash
ng e2e
```

Angular CLI does not include an end-to-end testing framework by default. Configure the framework that best fits your project's needs.

---

## Additional Resources

For more information on Angular CLI:

https://angular.dev/tools/cli

---

## License

This project is currently under active development and intended for internal evaluation and experimentation.


For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
