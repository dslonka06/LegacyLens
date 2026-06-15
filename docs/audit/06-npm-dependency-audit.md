# NPM Dependency Audit

**Project:** LegacyLens  
**Date:** 2026-06-15  
**Total Dependencies Audited:** 18 (11 runtime + 5 devDependencies + 2 mixed-role)

---

## Full Dependency Table

### Runtime Dependencies (`dependencies`)

| Package | Version | Purpose | Used By | Recommendation | Confidence |
|---|---|---|---|---|---|
| `@angular/common` | `^21.2.0` | Core Angular utilities: CommonModule (NgIf, NgFor, NgClass, AsyncPipe), HTTP client | `app.config.ts`, `app.ts`, `code-editor.ts`, multiple pages and services via `@angular/common/http` | Required | High |
| `@angular/compiler` | `^21.2.0` | Angular template compiler — required at build time for JIT and as a peer dep of `compiler-cli` | Build pipeline; no direct runtime imports but required by the Angular build system | Required | High |
| `@angular/core` | `^21.2.0` | Angular's foundational runtime: Component, Injectable, inject(), signals, change detection | Every component, service, and guard in the application | Required | High |
| `@angular/forms` | `^21.2.0` | Angular template-driven and reactive forms — FormsModule provides ngModel and related directives | `code-editor.ts`, `workspace-panel.ts`, `folder-analysis-page.ts` | Required | High |
| `@angular/platform-browser` | `^21.2.0` | Bootstraps the Angular application in the browser (`bootstrapApplication`) | `src/main.ts` | Required | High |
| `@angular/router` | `^21.2.0` | Angular routing: RouterOutlet, Router, Routes, CanActivateFn, NavigationEnd | `app.config.ts`, `app.routes.ts`, `app.ts`, `workspace-init.guard.ts`, `active-workspace.service.ts`, `sidebar.ts` | Required | High |
| `jspdf` | `^2.5.2` | Client-side PDF generation for analysis and documentation export | `pdf-export.service.ts` (dynamic import); `file-documentation-page.ts`, `folder-documentation-page.ts`, `repository-documentation-page.ts` | Required | High |
| `monaco-editor` | `0.55.1` | VS Code-based code editor engine; assets served from `node_modules/monaco-editor/min` via `angular.json` assets config | `angular.json` asset copy rule; runtime peer dep of `ngx-monaco-editor-v2` | Required | High |
| `ngx-monaco-editor-v2` | `21.1.4` | Angular wrapper around `monaco-editor` providing `MonacoEditorModule` and `NGX_MONACO_EDITOR_CONFIG` | `app.config.ts`, `components/code-editor/code-editor.ts` | Required | High |
| `rxjs` | `~7.8.0` | Reactive programming library — Observables, BehaviorSubject, Subject, operators | `app.ts`, `active-workspace.service.ts`, `global-search.ts`, `ai-analysis.service.ts`, `ai-knowledge.service.ts`, `workspace-manager.service.ts`, `repository-search.service.ts`, `theme.service.ts`, `navigation-context.service.ts`, majority of pages | Required | High |
| `tslib` | `^2.3.0` | TypeScript runtime helper library — reduces bundle size by sharing helpers rather than inlining them per file | No direct imports; used implicitly at compile time when `importHelpers: true` is set in `tsconfig.json` | Required | Medium |

### Dev Dependencies (`devDependencies`)

| Package | Version | Purpose | Used By | Recommendation | Confidence |
|---|---|---|---|---|---|
| `@angular/build` | `^21.2.13` | Angular's official application builder (esbuild/Vite-based), replaces `@angular-devkit/build-angular` | `angular.json` builder configuration | Required | High |
| `@angular/cli` | `^21.2.13` | Angular CLI — `ng serve`, `ng build`, `ng test` commands | `package.json` scripts | Required | High |
| `@angular/compiler-cli` | `^21.2.0` | Angular AOT compiler CLI — transforms Angular templates to TypeScript at build time | Build pipeline via `@angular/build` | Required | High |
| `jsdom` | `^28.0.0` | Browser DOM environment simulation for unit tests | `tsconfig.spec.json`; vitest resolves it automatically as the test environment for `app.spec.ts`, `code-editor.spec.ts`, `analysis-panel.spec.ts`, `sidebar.spec.ts` | Required | Medium |
| `prettier` | `^3.8.1` | Code formatter — enforces consistent code style | `.prettierrc` config file at repo root; no `format` script in `package.json`; no pre-commit hook or lint-staged config found | Optional | Medium |
| `typescript` | `~5.9.2` | TypeScript compiler — required to compile the entire Angular application | Build pipeline; all `.ts` source files | Required | High |
| `vitest` | `^4.0.8` | Vite-native test runner; replaces Karma/Jasmine for Angular unit tests | `tsconfig.spec.json` (vitest/globals types); all `*.spec.ts` test files; `package.json` test script | Required | High |

---

## Required Dependencies — Keep

All of the following are actively used and must be retained.

### Runtime

- **`@angular/common`** — CommonModule directives and HttpClient are used across dozens of files.
- **`@angular/compiler`** — Peer dependency of `@angular/compiler-cli`; required by the Angular build system even without direct source imports.
- **`@angular/core`** — Foundational to every Angular artifact in the project.
- **`@angular/forms`** — ngModel used in at least three components.
- **`@angular/platform-browser`** — Required to bootstrap the application.
- **`@angular/router`** — Routing, guards, and navigation events are used throughout.
- **`jspdf`** — Dynamically imported in `pdf-export.service.ts`; drives the export feature on all three documentation pages. The dynamic import keeps it out of the initial bundle.
- **`monaco-editor`** — Assets are copied to the build output via `angular.json`. Removing this would silently break the editor at runtime since no TypeScript import would surface the error at build time.
- **`ngx-monaco-editor-v2`** — Angular integration layer for `monaco-editor`; provides the component and config token used in `code-editor.ts`.
- **`rxjs`** — Used in the majority of services and pages; not replaceable without a significant rewrite.
- **`tslib`** — No direct `import` statements exist in app source, but this is expected behavior when `importHelpers: true` is active. Verify in `tsconfig.json` before drawing any conclusions. Removing it when `importHelpers` is enabled causes build failures or silently increases bundle size.

### Dev

- **`@angular/build`** — The project's build system; without it `ng build` and `ng serve` do not function.
- **`@angular/cli`** — Required to execute all `package.json` scripts.
- **`@angular/compiler-cli`** — AOT compilation; required by `@angular/build`.
- **`jsdom`** — Required as the vitest test environment. Verify by checking the vitest configuration for `environment: 'jsdom'`. If it is absent, `jsdom` may be a transitive dependency already pulled in by vitest itself rather than a direct requirement — in that case it can be removed from `devDependencies` but the transitive version will still be used.
- **`typescript`** — Required to compile all `.ts` source files.
- **`vitest`** — The project's test runner; `ng test` resolves to vitest via `@angular/build`.

---

## Optional Dependencies — Consider

| Package | Reason |
|---|---|
| `prettier` | `.prettierrc` confirms intentional adoption, but there is no `format` script in `package.json` and no pre-commit hook or lint-staged configuration to enforce it. It currently functions as a passive developer tool. Low risk to retain; a removal candidate only if the team has explicitly decided not to enforce formatting. |

---

## Removal Candidates

### `prettier`

**Recommendation:** Evaluate before removing.

**What to verify before removing:**

1. Confirm no IDE workspace settings (`.vscode/settings.json`, `.idea/`) rely on `prettier` as the default formatter — removing the package while IDE auto-format is enabled will cause silent no-ops or fallback to a different formatter.
2. Check all developer machines and any CI pipeline for a `format` or `lint` stage that invokes `prettier` outside of `package.json` scripts.
3. If the team wants to enforce formatting going forward, add a `format` script (`prettier --write .`) and optionally wire it into a pre-commit hook via `lint-staged` before removing it as a passive dependency.
4. If no enforcement is planned and no IDE integration exists, the package can be removed with no functional impact.

**Risk level:** Low — no build step or test depends on it.

---

## Notes on Medium-Confidence Items

| Package | Concern | Suggested Verification |
|---|---|---|
| `tslib` | No explicit `import 'tslib'` found in source, which is normal for implicit usage | Check `tsconfig.json` for `"importHelpers": true`; if present, `tslib` is required |
| `jsdom` | Not explicitly imported in test files; vitest resolves it as the test environment | Check vitest config (inline in `package.json` or `vitest.config.ts`) for `environment: 'jsdom'`; if absent it may be a transitive dep |
| `prettier` | `.prettierrc` exists but no enforcement pipeline found | Audit developer workflow and CI for any formatter invocations outside `package.json` |
