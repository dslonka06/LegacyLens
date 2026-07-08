# Phase 4 — Code Intelligence Engine
## Formal Specification

---

## Objective

Develop a modular Code Intelligence Engine that analyzes any supported input — file, folder, or repository — and produces a structured Knowledge Model that serves as the single source of truth for the application.

Phase 4 consolidates all analysis logic into the Electron backend. Angular transitions from an analysis runtime into a pure presentation layer. Every downstream feature — AI analysis, architecture, documentation, recommendations, and learning paths — consumes the Knowledge Model through a centralized Knowledge Service rather than performing independent analysis.

---

## Architectural Principles

**Single Intelligence Engine**
One engine processes all analysis types. Behavior adapts through capabilities rather than separate implementations.

**Capability-Driven**
Features such as language detection, framework detection, dependency resolution, and Git analysis are modular capabilities that execute only when applicable to the detected analysis target.

**Knowledge Before AI**
The engine builds structured knowledge first. AI consumes that knowledge but never participates in generating it.

**Single Source of Truth**
The generated Knowledge Model is the authoritative representation of the analyzed artifact. No application feature independently re-parses source code after analysis completes.

**Extensible by Design**
New analysis capabilities and language parsers can be added without modifying the engine's core workflow or existing application features.

**Angular as Presentation Only**
Angular is responsible for rendering, navigation, and user interaction. It requests data through IPC and never performs repository analysis, filesystem traversal, or knowledge generation.

---

## Responsibility Split

### Angular
- Rendering UI
- Navigation and routing
- User interaction
- Displaying data returned via IPC
- Requesting operations through IPC

### Electron
- Filesystem access
- Repository scanning
- Code Intelligence Engine
- Knowledge Model generation
- AI orchestration and HTTP transport
- SQLite interaction
- Context generation
- Analysis execution and cache management

### SQLite
- Repository metadata
- Knowledge Models
- Analysis history
- AI outputs
- Application settings
- Incremental state

---

## Pipeline

Every analysis follows the same pipeline regardless of input type:

```
Input (File / Folder / Repository)
  ↓
Target Validation
  ↓
Capability Selection
  ↓
Code Processing
  ↓
Knowledge Model
  ↓
SQLite
  ↓
AI / Documentation / Architecture / Recommendations
```

---

## Performance Contract

Page navigation never triggers a new analysis. The expected load workflow is:

```
Open Workspace
  ↓
Load Knowledge Model from SQLite
  ↓
Populate Memory Cache
  ↓
Render UI
  ↓
Background Repository Validation
  ↓
Incremental Update (if required)
  ↓
Refresh affected data
```

Analysis only occurs when:
- A repository is analyzed for the first time
- The user explicitly requests re-analysis
- Repository changes invalidate the stored Knowledge Model

---

## Deliverables

---

### D0 — Analysis Engine Migration

#### Description

Migrate all existing analysis logic from Angular into Electron before any new intelligence functionality is introduced. This is a faithful port — no behavior changes, no improvements. The goal is architectural parity.

Angular analysis services are replaced with IPC-based requests to the Electron backend. Source code parsing and repository analysis execute exclusively within the Electron process after this deliverable is complete.

This deliverable completes before D1–D7 begin.

#### Migration Strategy

**Stage 1 — Faithful Migration**
Move the existing analysis implementation from Angular into Electron without changing behavior. The goal is architectural parity with the current system.

**Stage 2 — Progressive Improvement** *(post-D0, within Phase 4)*
Once Electron owns the analysis pipeline, individual components such as the PatternParser, context generation, and dependency analysis can be upgraded independently without risk to the rest of the system.

#### Acceptance Criteria
- All existing analysis services in Angular are replaced with IPC-based requests to the Electron backend
- Source code parsing and repository analysis execute exclusively within the Electron process
- Angular no longer directly accesses repository contents or performs analysis
- Existing functionality remains unchanged from the user's perspective after migration
- The Electron backend becomes the sole owner of repository analysis and knowledge generation
- Angular services that are fully absorbed by Electron are removed; those with remaining UI responsibilities become thin IPC clients

---

### D1 — Target Validation

#### Description

After the user selects an analysis type and chooses a path from the filesystem, the Code Intelligence Engine validates that the input matches the intended analysis type. The three explicit entry points on the homepage — File Analysis, Folder Analysis, Repository Analysis — are preserved. Detection exists to validate and assist the user's choice, not replace it.

Supported analysis targets:
- **Single File** — a source code file
- **Project Folder** — a directory containing project files but no Git metadata
- **Repository** — a directory containing a valid `.git/` structure

If a mismatch is detected, the application guides the user rather than proceeding blindly.

**Example — Repository selected, folder has no `.git/`:**
> "The selected folder does not appear to be a Git repository. Would you like to analyze it as a Project Folder instead?"

**Example — Folder Analysis selected, `.git/` detected:**
> "A Git repository was detected. Analyze as a Repository instead?"

#### Acceptance Criteria
- The engine validates the selected path against the user's intended analysis type before analysis begins
- Analysis targets are classified as File, Folder, or Repository
- Mismatches surface a user-facing prompt offering to continue with the correct analysis type
- Invalid or unsupported inputs are handled gracefully with a clear error message
- Target validation is reusable across all application entry workflows
- The three homepage entry points remain unchanged

---

### D2 — Capability-Based Analysis Pipeline

#### Description

The engine activates only the processing capabilities required for the validated analysis target. Capabilities are modular, independently executable units of analysis logic.

| Capability | File | Folder | Repository |
|---|:---:|:---:|:---:|
| File Parsing | ✅ | ✅ | ✅ |
| Language Detection | ✅ | ✅ | ✅ |
| Symbol Extraction | ✅ | ✅ | ✅ |
| Folder Structure | ❌ | ✅ | ✅ |
| Framework Detection | ❌ | ✅ | ✅ |
| Dependency Resolution | ❌ | ✅ | ✅ |
| Multi-project Detection | ❌ | ⚠️ if applicable | ✅ |
| Git Analysis | ❌ | ❌ | ✅ |
| Architecture Discovery | ❌ | Limited | ✅ |

Repository analysis builds on everything folder and file analysis already do — these are layers, not separate engines.

#### Acceptance Criteria
- Analysis capabilities execute based on the validated analysis target
- Capabilities operate independently and can be enabled or disabled without affecting unrelated functionality
- New capabilities can be added without modifying the core analysis pipeline
- Capabilities share a common execution interface
- Capability execution order is deterministic and configurable

---

### D3 — Code Processing

#### Description

Process supported source code into structured programming constructs. An `ICodeParser` interface abstracts the parsing implementation, allowing individual language parsers to be upgraded independently without affecting the engine.

**Parser architecture:**
```
ICodeParser
  ├── PatternParser       ← Phase 4 initial implementation (wraps existing regex logic)
  ├── TreeSitterParser    ← future
  ├── RoslynParser        ← future (.NET)
  └── TypeScriptParser    ← future (TypeScript Compiler API)
```

The initial `PatternParser` wraps the existing regex-based parsing logic inside the new interface. No new parser dependencies are introduced in Phase 4.

Depending on language support, extracted information may include:
- Classes, interfaces, namespaces, modules
- Methods and functions
- Imports and exports
- File-level metrics

#### Acceptance Criteria
- An `ICodeParser` interface is defined and used by the engine
- `PatternParser` implements `ICodeParser` using the existing regex-based logic
- Supported languages are parsed into structured code elements
- Structural elements retain references to their originating files
- Parsing failures in individual files do not terminate the overall analysis
- New language parsers can be added by implementing `ICodeParser` without modifying the engine

---

### D4 — Knowledge Model Generation

#### Description

Generate a structured Knowledge Model representing the analyzed artifact. The model adapts to the validated analysis target — a file model contains only file-relevant information, a folder model expands to include project structure, a repository model includes repository-wide relationships and metadata.

The model exposes only information that actually exists for the current analysis. Downstream features check for the presence of a capability rather than checking the analysis type.

**Example — capability check pattern:**
```
Does this workspace have Architecture capability?
  → Yes: render Architecture page
  → No:  hide Architecture page
```

#### Acceptance Criteria
- A Knowledge Model is generated for every successful analysis
- The model adapts to the validated analysis target
- Shared information is represented consistently across all analysis types
- Repository-specific data is included only when a Repository target is confirmed
- The Knowledge Model is persisted using the Phase 2 SQLite data layer
- Downstream features can query the model for capability presence without checking analysis type directly

---

### D5 — Context Generation

#### Description

Generate structured analysis context from the Knowledge Model for consumption by application features. Features consume generated context rather than directly accessing source files or rebuilding context independently.

Context consumers include:
- AI analysis
- Documentation generation
- Architecture views
- Learning paths
- Recommendations

#### Acceptance Criteria
- Context is generated from the Knowledge Model, not from raw source files
- Context generation is independent of AI providers
- Context contains only information relevant to the requesting feature
- Features consume generated context rather than directly accessing source files
- Context generation is reusable across all supported analysis types

---

### D6 — Incremental Updates

#### Description

Extend the Phase 2 incremental analysis pipeline so that changes invalidate and regenerate only the affected portions of the Knowledge Model. Phase 2 already establishes file hashing, change detection, and cache validation. Phase 4 builds on that foundation — it does not replace it.

**Extended workflow:**
```
Phase 2: Changed files detected via hash comparison
  ↓
Phase 4: Only affected Knowledge Model portions regenerated
  ↓
Unchanged knowledge preserved
  ↓
Updated knowledge synchronized to SQLite
```

#### Acceptance Criteria
- Modified files are detected using the Phase 2 hash-based change detection pipeline
- Only affected portions of the Knowledge Model are regenerated
- Existing knowledge is preserved where no changes are detected
- Incremental processing produces results equivalent to a full analysis
- Updated knowledge is synchronized with SQLite

---

### D7 — Knowledge Service

#### Description

Expose the generated Knowledge Model through a centralized IPC-accessible service layer. All application features retrieve structured knowledge from this service. No feature performs independent source code parsing after analysis completes.

#### Acceptance Criteria
- The Knowledge Model is accessible through a centralized service exposed via IPC
- Features retrieve structured knowledge from the service rather than performing independent analysis
- No application feature independently parses source code after analysis completes
- The service remains independent of UI implementation
- The Knowledge Model serves as the application's single source of truth for all analyzed content

---

## Definition of Done

Phase 4 is complete when:

1. All existing Angular analysis logic has been migrated to the Electron backend with no change in user-facing behavior
2. The Code Intelligence Engine processes file, folder, and repository inputs through a single capability-driven pipeline
3. Target validation detects and surfaces mismatches between user intent and selected input
4. The `ICodeParser` interface is in place with `PatternParser` as the initial implementation
5. A structured Knowledge Model is generated, adapted to the analysis target, and persisted to SQLite
6. Incremental updates extend Phase 2 change detection to regenerate only affected knowledge
7. All application features consume the Knowledge Model through the centralized Knowledge Service
8. Angular no longer performs repository analysis, filesystem traversal, or source code parsing

---

## Deferred to UI Redesign Phase

The following are explicitly out of scope for Phase 4 and will be addressed during the dedicated UI redesign phase, after the platform, intelligence engine, and application workflows are stable:

- Page consolidation (24 current page components → shared capability-aware pages)
- Capability-aware routing and navigation guards
- Shared page layouts and component library
- Loading states and skeleton screens
- Homepage redesign
- Design system formalization

---

Generated by Rocket Flow · 2.0.20 · 2026-07-08
