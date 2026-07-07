# 07 — Recommended Folder Structure

**Status:** Proposal only. No files have been moved.
**Scope:** `src/app/` restructure for SystemLens Angular 21

---

## 1. Proposed Directory Tree

```
src/app/
│
├── core/
│   │   # App-wide infrastructure: bootstrapping, routing, global config
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── app.html
│   ├── app.scss
│   ├── app.ts
│   ├── app.spec.ts
│   │
│   ├── guards/
│   │   └── workspace-init.guard.ts
│   │
│   └── services/
│       # Services with no domain affinity — used everywhere
│       ├── theme.service.ts
│       ├── panel-layout.service.ts
│       └── active-workspace.service.ts
│
├── layout/
│   │   # Shell chrome: sidebar, resize divider — rendered regardless of workspace
│   ├── sidebar/
│   │   ├── sidebar.ts
│   │   ├── sidebar.html
│   │   ├── sidebar.scss
│   │   └── sidebar.spec.ts
│   └── resize-divider/
│       ├── resize-divider.component.ts
│       └── resize-divider.component.scss
│
├── workspace/
│   │   # Workspace lifecycle: creation, switching, isolation, classification
│   ├── models/
│   │   ├── workspace-entity.model.ts
│   │   ├── workspace-context.model.ts
│   │   └── workspace.model.ts
│   ├── services/
│   │   ├── workspace-manager.service.ts
│   │   ├── workspace-classifier.service.ts
│   │   ├── workspace-importer.interface.ts
│   │   ├── current-workspace.service.ts
│   │   └── current-analysis.service.ts
│   └── components/
│       ├── workspace-panel/
│       │   ├── workspace-panel.ts
│       │   ├── workspace-panel.html
│       │   └── workspace-panel.scss
│       ├── workspace-summary/
│       │   ├── workspace-summary.ts
│       │   ├── workspace-summary.html
│       │   └── workspace-summary.scss
│       └── workspace-switcher-modal/
│           ├── workspace-switcher-modal.ts
│           ├── workspace-switcher-modal.html
│           └── workspace-switcher-modal.scss
│
├── knowledge/
│   │   # File ingestion and static analysis pipeline — no AI, no HTTP
│   ├── models/
│   │   ├── knowledge.model.ts
│   │   ├── architecture-analysis.model.ts
│   │   ├── technology.model.ts
│   │   └── repository.model.ts
│   └── services/
│       ├── repository-knowledge.service.ts
│       ├── file-content.service.ts
│       ├── file-inventory.service.ts
│       ├── dependency-mapper.service.ts
│       ├── dependency-explorer.service.ts
│       ├── architecture-detector.service.ts
│       ├── repository-scanner.service.ts
│       ├── project-discovery.service.ts
│       └── technology-detector.service.ts
│
├── features/
│   │
│   ├── file-analysis/
│   │   └── pages/
│   │       ├── file-analysis-page/
│   │       ├── file-architecture-page/
│   │       ├── file-data-flow-page/
│   │       ├── file-code-recommendations-page/
│   │       ├── file-security-page/
│   │       ├── file-documentation-page/
│   │       ├── file-system-understanding-page/
│   │       └── file-learning-path-page/
│   │
│   ├── folder-analysis/
│   │   └── pages/
│   │       ├── folder-analysis-page/
│   │       ├── folder-architecture-page/
│   │       ├── folder-data-flow-page/
│   │       ├── folder-code-recommendations-page/
│   │       ├── folder-security-page/
│   │       ├── folder-documentation-page/
│   │       ├── folder-system-understanding-page/
│   │       └── folder-learning-path-page/
│   │
│   ├── repository-analysis/
│   │   └── pages/
│   │       ├── repository-analysis-page/
│   │       ├── repository-architecture-page/
│   │       ├── repository-data-flow-page/
│   │       ├── repository-code-recommendations-page/
│   │       ├── repository-security-page/
│   │       ├── repository-documentation-page/
│   │       ├── repository-system-understanding-page/
│   │       └── repository-learning-path-page/
│   │
│   ├── search/
│   │   ├── components/
│   │   │   └── global-search/
│   │   │       ├── global-search.ts
│   │   │       ├── global-search.html
│   │   │       └── global-search.scss
│   │   ├── models/
│   │   │   └── search-result.model.ts
│   │   └── services/
│   │       └── repository-search.service.ts
│   │
│   └── settings/
│       └── pages/
│           └── settings-page/
│               ├── settings-page.ts
│               ├── settings-page.html
│               └── settings-page.scss
│
├── analysis/
│   │   # Cross-workspace domain analysis logic — used by all 3 workspace features
│   ├── models/
│   │   ├── analysis-session.model.ts
│   │   ├── analysis-result.model.ts
│   │   ├── ai-analysis-result.model.ts
│   │   ├── ai-explanation-context.model.ts
│   │   ├── data-flow.model.ts
│   │   ├── security-analysis.model.ts
│   │   ├── system-understanding.model.ts
│   │   ├── recommendation-analysis.model.ts
│   │   ├── learning-path-analysis.model.ts
│   │   ├── navigation.model.ts
│   │   ├── code-recommendation.model.ts
│   │   ├── risk-item.model.ts
│   │   ├── modernization-item.model.ts
│   │   ├── modernization-recommendation.model.ts
│   │   ├── generated-documentation.model.ts
│   │   └── repository-summary.model.ts
│   └── services/
│       ├── analysis.service.ts
│       ├── security-analysis.service.ts
│       ├── system-understanding.service.ts
│       ├── learning-path-analysis.service.ts
│       ├── recommendation-analysis.service.ts
│       ├── data-flow-discovery.service.ts
│       ├── workflow-explorer.service.ts
│       ├── change-impact.service.ts
│       ├── repository-insights.service.ts
│       ├── repository-summary.service.ts
│       ├── node-intelligence.facade.ts
│       ├── navigation-context.service.ts
│       ├── documentation-builder.service.ts
│       └── pdf-export.service.ts
│
├── ai/
│   │   # All HTTP calls to the AI backend + prompt builders
│   ├── services/
│   │   ├── ai-analysis.service.ts
│   │   └── ai-knowledge.service.ts
│   └── prompts/
│       ├── repository-explanation-prompt.ts
│       ├── security-overview-prompt.ts
│       └── workflow-explanation-prompt.ts
│
└── shared/
    │   # Reusable display components and shared UI utilities
    ├── components/
    │   ├── analysis-panel/
    │   │   ├── analysis-panel.ts
    │   │   ├── analysis-panel.html
    │   │   ├── analysis-panel.scss
    │   │   └── analysis-panel.spec.ts
    │   ├── code-editor/
    │   │   ├── code-editor.ts
    │   │   ├── code-editor.html
    │   │   ├── code-editor.scss
    │   │   └── code-editor.spec.ts
    │   ├── explanation-card/
    │   │   ├── explanation-card.ts
    │   │   ├── explanation-card.html
    │   │   └── explanation-card.scss
    │   ├── repository-callout/
    │   │   ├── repository-callout.ts
    │   │   ├── repository-callout.html
    │   │   └── repository-callout.scss
    │   ├── repository-intelligence/
    │   │   ├── repository-intelligence.ts
    │   │   ├── repository-intelligence.html
    │   │   └── repository-intelligence.scss
    │   └── repository-preview/
    │       ├── repository-preview.ts
    │       ├── repository-preview.html
    │       └── repository-preview.scss
    └── pages/
        └── home-page/
            ├── home-page.ts
            ├── home-page.html
            └── home-page.scss
```

---

## 2. Migration Guide — Where Each Folder's Contents Move

### `src/app/` (root files)

| Current file | Destination |
|---|---|
| `app.config.ts` | `core/app.config.ts` |
| `app.routes.ts` | `core/app.routes.ts` |
| `app.html` | `core/app.html` |
| `app.scss` | `core/app.scss` |
| `app.ts` | `core/app.ts` |
| `app.spec.ts` | `core/app.spec.ts` |

---

### `src/app/guards/`

| Current file | Destination |
|---|---|
| `workspace-init.guard.ts` | `core/guards/workspace-init.guard.ts` |

The guard itself imports workspace services. After workspace services move to `workspace/services/`, update those imports. The guard's physical location is `core/` because it is referenced directly from `app.routes.ts`.

---

### `src/app/components/` (12 files, mixed concerns)

| Current file | Destination | Reason |
|---|---|---|
| `sidebar.*` | `layout/sidebar/` | Shell chrome, not a domain widget |
| `resize-divider.*` | `layout/resize-divider/` | Shell chrome |
| `workspace-panel.*` | `workspace/components/workspace-panel/` | Workspace lifecycle UI |
| `workspace-summary.*` | `workspace/components/workspace-summary/` | Workspace lifecycle UI |
| `workspace-switcher-modal.*` | `workspace/components/workspace-switcher-modal/` | Workspace lifecycle UI |
| `global-search.*` | `features/search/components/global-search/` | Tightly coupled to search service |
| `analysis-panel.*` | `shared/components/analysis-panel/` | Generic display widget |
| `code-editor.*` | `shared/components/code-editor/` | Generic display widget |
| `explanation-card.*` | `shared/components/explanation-card/` | Generic display widget |
| `repository-callout.*` | `shared/components/repository-callout/` | Generic display widget |
| `repository-intelligence.*` | `shared/components/repository-intelligence/` | Generic display widget |
| `repository-preview.*` | `shared/components/repository-preview/` | Generic display widget |

---

### `src/app/models/` (24 files, all domains flat)

| Current file | Destination |
|---|---|
| `workspace-entity.model.ts` | `workspace/models/` |
| `workspace-context.model.ts` | `workspace/models/` |
| `workspace.model.ts` | `workspace/models/` |
| `knowledge.model.ts` | `knowledge/models/` |
| `architecture-analysis.model.ts` | `knowledge/models/` |
| `technology.model.ts` | `knowledge/models/` |
| `repository.model.ts` | `knowledge/models/` |
| `analysis-session.model.ts` | `analysis/models/` |
| `analysis-result.model.ts` | `analysis/models/` |
| `ai-analysis-result.model.ts` | `analysis/models/` |
| `ai-explanation-context.model.ts` | `analysis/models/` |
| `data-flow.model.ts` | `analysis/models/` |
| `security-analysis.model.ts` | `analysis/models/` |
| `system-understanding.model.ts` | `analysis/models/` |
| `recommendation-analysis.model.ts` | `analysis/models/` |
| `learning-path-analysis.model.ts` | `analysis/models/` |
| `navigation.model.ts` | `analysis/models/` |
| `code-recommendation.model.ts` | `analysis/models/` |
| `risk-item.model.ts` | `analysis/models/` |
| `modernization-item.model.ts` | `analysis/models/` |
| `modernization-recommendation.model.ts` | `analysis/models/` |
| `generated-documentation.model.ts` | `analysis/models/` |
| `repository-summary.model.ts` | `analysis/models/` |
| `search-result.model.ts` | `features/search/models/` |

---

### `src/app/pages/` (34 files, all flat)

All workspace-specific pages group under their workspace feature folder. Each page gets its own subfolder to hold `.ts`, `.html`, and `.scss`.

| Current prefix | Destination |
|---|---|
| `home-page.*` | `shared/pages/home-page/` |
| `file-analysis-page.*` | `features/file-analysis/pages/file-analysis-page/` |
| `file-architecture-page.*` | `features/file-analysis/pages/file-architecture-page/` |
| `file-data-flow-page.*` | `features/file-analysis/pages/file-data-flow-page/` |
| `file-code-recommendations-page.*` | `features/file-analysis/pages/file-code-recommendations-page/` |
| `file-security-page.*` | `features/file-analysis/pages/file-security-page/` |
| `file-documentation-page.*` | `features/file-analysis/pages/file-documentation-page/` |
| `file-system-understanding-page.*` | `features/file-analysis/pages/file-system-understanding-page/` |
| `file-learning-path-page.*` | `features/file-analysis/pages/file-learning-path-page/` |
| `folder-analysis-page.*` | `features/folder-analysis/pages/folder-analysis-page/` |
| `folder-architecture-page.*` | `features/folder-analysis/pages/folder-architecture-page/` |
| `folder-data-flow-page.*` | `features/folder-analysis/pages/folder-data-flow-page/` |
| `folder-code-recommendations-page.*` | `features/folder-analysis/pages/folder-code-recommendations-page/` |
| `folder-security-page.*` | `features/folder-analysis/pages/folder-security-page/` |
| `folder-documentation-page.*` | `features/folder-analysis/pages/folder-documentation-page/` |
| `folder-system-understanding-page.*` | `features/folder-analysis/pages/folder-system-understanding-page/` |
| `folder-learning-path-page.*` | `features/folder-analysis/pages/folder-learning-path-page/` |
| `repository-analysis-page.*` | `features/repository-analysis/pages/repository-analysis-page/` |
| `repository-architecture-page.*` | `features/repository-analysis/pages/repository-architecture-page/` |
| `repository-data-flow-page.*` | `features/repository-analysis/pages/repository-data-flow-page/` |
| `repository-code-recommendations-page.*` | `features/repository-analysis/pages/repository-code-recommendations-page/` |
| `repository-security-page.*` | `features/repository-analysis/pages/repository-security-page/` |
| `repository-documentation-page.*` | `features/repository-analysis/pages/repository-documentation-page/` |
| `repository-system-understanding-page.*` | `features/repository-analysis/pages/repository-system-understanding-page/` |
| `repository-learning-path-page.*` | `features/repository-analysis/pages/repository-learning-path-page/` |
| `settings-page.*` | `features/settings/pages/settings-page/` |

---

### `src/app/services/` (34 files, flat)

| Current file | Destination |
|---|---|
| `theme.service.ts` | `core/services/` |
| `panel-layout.service.ts` | `core/services/` |
| `active-workspace.service.ts` | `core/services/` |
| `workspace-manager.service.ts` | `workspace/services/` |
| `workspace-classifier.service.ts` | `workspace/services/` |
| `workspace-importer.interface.ts` | `workspace/services/` |
| `current-workspace.service.ts` | `workspace/services/` |
| `current-analysis.service.ts` | `workspace/services/` |
| `repository-knowledge.service.ts` | `knowledge/services/` |
| `file-content.service.ts` | `knowledge/services/` |
| `file-inventory.service.ts` | `knowledge/services/` |
| `dependency-mapper.service.ts` | `knowledge/services/` |
| `dependency-explorer.service.ts` | `knowledge/services/` |
| `architecture-detector.service.ts` | `knowledge/services/` |
| `repository-scanner.service.ts` | `knowledge/services/` |
| `project-discovery.service.ts` | `knowledge/services/` |
| `technology-detector.service.ts` | `knowledge/services/` |
| `analysis.service.ts` | `analysis/services/` |
| `security-analysis.service.ts` | `analysis/services/` |
| `system-understanding.service.ts` | `analysis/services/` |
| `learning-path-analysis.service.ts` | `analysis/services/` |
| `recommendation-analysis.service.ts` | `analysis/services/` |
| `data-flow-discovery.service.ts` | `analysis/services/` |
| `workflow-explorer.service.ts` | `analysis/services/` |
| `change-impact.service.ts` | `analysis/services/` |
| `repository-insights.service.ts` | `analysis/services/` |
| `repository-summary.service.ts` | `analysis/services/` |
| `node-intelligence.facade.ts` | `analysis/services/` |
| `navigation-context.service.ts` | `analysis/services/` |
| `documentation-builder.service.ts` | `analysis/services/` |
| `pdf-export.service.ts` | `analysis/services/` |
| `ai-analysis.service.ts` | `ai/services/` |
| `ai-knowledge.service.ts` | `ai/services/` |
| `repository-search.service.ts` | `features/search/services/` |

---

### `src/app/services/prompts/` (3 files)

| Current file | Destination |
|---|---|
| `repository-explanation-prompt.ts` | `ai/prompts/` |
| `security-overview-prompt.ts` | `ai/prompts/` |
| `workflow-explanation-prompt.ts` | `ai/prompts/` |

---

## 3. Files That Stay in Place

No files in `src/app/` stay in their current location — the intent of this restructure is to fully eliminate the flat `components/`, `models/`, `pages/`, and `services/` top-level folders. The following files at the project root are unaffected:

- `angular.json`
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json`
- `package.json`
- `index.html`
- `main.ts`
- `styles.scss`
- All files under `src/assets/`, `src/environments/`

---

## 4. Migration Risk Assessment

### High Risk

**Angular lazy-loading import paths in `app.routes.ts`**

Every route uses an `import()` string pointing to the page component's current file path. Moving all 25 lazy-loaded page components will invalidate every one of those strings. The build will fail silently at runtime (lazy chunk not found) unless all 25 paths are updated in lockstep with the file moves.

Example of what will break:
```ts
// Before move
loadComponent: () => import('./pages/file-architecture-page/...')
// After move — must become
loadComponent: () => import('./features/file-analysis/pages/file-architecture-page/...')
```

**Service injection chains — relative imports across domain boundaries**

Many services import from `../models/` or `../services/` using relative paths. After moving files into different domain folders the relative paths will silently resolve to wrong locations or fail the TypeScript compiler. Services most at risk are those with wide fan-out: `RepositoryKnowledgeService` (calls ~8 knowledge pipeline services), `AiAnalysisService` (imports AI models), and any page component that imports directly from `../services/` or `../models/`.

**`app.ts` bootstrap references**

If `app.ts` imports `Sidebar`, `WorkspacePanel`, or other components directly (as standalone component declarations or in providers), those import paths break when components move.

---

### Medium Risk

**`tsconfig.json` path alias gaps**

If path aliases (`@app/*`) are not in place before files move, every developer's IDE and the Angular compiler will report errors for every import that crosses the old folder boundary. This is fixable but noisy if done mid-migration.

**Barrel files (`index.ts`)**

If any current folder has an `index.ts` barrel exporting its contents, consumers importing from that barrel will break when the underlying files move out. Verify whether `models/`, `services/`, `components/`, or `pages/` have barrel files before starting.

**Spec files and test imports**

`analysis-panel.spec.ts` and `code-editor.spec.ts` reference their subjects via relative paths. If specs are not moved together with their component files, the test runner will fail to locate the subject.

---

### Low Risk

**Orphaned legacy redirects (`app.routes.ts`)**

The 10 orphaned redirect routes (`analysis`, `architecture`, `data-flow`, `risks`, `modernization`, `security`, `documentation`, `history`, `repository-navigation`, `nav-playground`) do not reference component files via lazy imports — they use `redirectTo` strings only. Moving page components does not affect these routes. They remain a separate cleanup concern.

**SCSS `@use` / `@forward` paths**

Component SCSS files typically do not cross-import other component SCSS. Risk is low unless there is a shared `variables.scss` imported via a relative path. Verify this before moving layout or shared components.

**`services/prompts/` subfolder**

The three prompt builder files already form a natural cohort and move intact to `ai/prompts/`. No other file imports from this subfolder other than `AiAnalysisService` and `AiKnowledgeService`, which are themselves moving to `ai/services/`. The import path update is isolated to two files.

---

## 5. Recommended Migration Order (Safest First)

The order is designed so that at the end of each step the application still compiles. Each step's changes should be committed and build-verified before proceeding to the next.

---

### Step 1 — Add `tsconfig` path aliases (no file moves)

Before touching any file locations, add path aliases to `tsconfig.json`:

```json
"paths": {
  "@app/core/*":      ["src/app/core/*"],
  "@app/layout/*":    ["src/app/layout/*"],
  "@app/workspace/*": ["src/app/workspace/*"],
  "@app/knowledge/*": ["src/app/knowledge/*"],
  "@app/analysis/*":  ["src/app/analysis/*"],
  "@app/ai/*":        ["src/app/ai/*"],
  "@app/features/*":  ["src/app/features/*"],
  "@app/shared/*":    ["src/app/shared/*"]
}
```

This step is purely additive. Existing relative imports still work. Aliases let you incrementally update imports to the new paths before the files actually move.

---

### Step 2 — Move `ai/prompts/` (3 files, 2 consumers)

Move `services/prompts/*.ts` to `ai/prompts/`. Update the two import references in `ai-analysis.service.ts` and `ai-knowledge.service.ts` (which have not moved yet — update in place). This is the smallest possible change and validates the alias-based approach.

---

### Step 3 — Move `ai/services/` (2 files)

Move `ai-analysis.service.ts` and `ai-knowledge.service.ts` to `ai/services/`. Update all consumers (likely analysis services and page components) to use `@app/ai/services/...`. The prompt imports from Step 2 now also move with these files — keep them relative (`../prompts/`) so no alias is needed across the `ai/` boundary.

---

### Step 4 — Move `knowledge/models/` then `knowledge/services/` (4 models + 9 services)

Models have no service imports; move them first. Then move services and update their model imports. `RepositoryKnowledgeService` is the highest-fan-out service in this group — update it last after all its dependencies have moved and aliases are confirmed working.

---

### Step 5 — Move `workspace/models/` then `workspace/services/` (3 models + 5 services)

Same pattern: models first, then services. `WorkspaceManagerService` depends on `WorkspaceClassifierService` and the workspace models — verify both are updated before moving the manager.

---

### Step 6 — Move `analysis/models/` then `analysis/services/` (16 models + 14 services)

This is the largest model and service batch. Move models first (no service dependencies). Then move services in dependency order: leaf services (no cross-service imports within `analysis/`) first, facade last (`NodeIntelligenceFacade`, `NavigationContextService`).

---

### Step 7 — Move `core/services/` (3 files) and `core/guards/` (1 file)

`ThemeService`, `PanelLayoutService`, and `ActiveWorkspaceService` have no domain imports. Move them and update the single consumer each (likely `app.ts`, `sidebar.ts`, or root layout). Move `workspace-init.guard.ts` to `core/guards/` and update its import in `app.routes.ts`.

---

### Step 8 — Move `shared/components/` (6 components)

All 6 shared display components are stateless widgets. Move each one's `.ts`, `.html`, `.scss`, and `.spec.ts` files together. Update imports in the page components and layout components that reference them. Commit and verify after each component to keep the diff reviewable.

---

### Step 9 — Move `layout/` components (Sidebar, ResizeDivider)

`Sidebar` is imported in `app.ts` or the root shell. Update that import. `ResizeDivider` is likely referenced by `Sidebar` or `PanelLayoutService` — update those in place.

---

### Step 10 — Move `workspace/components/` (3 components)

`WorkspacePanel`, `WorkspaceSummary`, and `WorkspaceSwitcherModal`. These import from `workspace/services/` (already moved in Step 5). Update their service import paths to `@app/workspace/services/...`.

---

### Step 11 — Move `features/search/` (component + model + service)

Move `GlobalSearch` component, `search-result.model.ts`, and `RepositorySearchService` together. All three are tightly coupled — moving them as a unit keeps the diff local to the `features/search/` folder.

---

### Step 12 — Move `features/settings/` (1 page)

`SettingsPage` is a single standalone page with minimal service dependencies. Move it and update the lazy-load path in `app.routes.ts`.

---

### Step 13 — Move `shared/pages/home-page/` (1 page)

`HomePage` is the root route component. Move it and update the lazy-load path in `app.routes.ts`.

---

### Step 14 — Move all workspace feature pages (24 pages across 3 workspace folders)

Move all file-analysis, folder-analysis, and repository-analysis pages. Update the 24 lazy-load paths in `app.routes.ts` in one commit. This is the highest-volume single change but by Step 14 all service and model imports in these pages will already resolve via aliases set in Step 1.

---

### Step 15 — Move root `app.*` files to `core/`

Move `app.ts`, `app.config.ts`, `app.routes.ts`, `app.html`, `app.scss`, `app.spec.ts` to `core/`. Update `main.ts` to point to `./core/app` (or `./core/app.config` depending on bootstrapping pattern). This is last because `app.routes.ts` is the file most edited throughout Steps 1–14.

---

### Step 16 — Delete empty legacy folders

Once all files have moved, remove the now-empty `components/`, `models/`, `pages/`, `services/`, and `guards/` top-level folders. Verify no stale imports remain with a project-wide search for `'../models/`, `'../services/`, `'../pages/`, `'../components/`, `'../guards/`.
