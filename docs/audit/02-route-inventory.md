# Route Inventory — SystemLens

**Branch:** navigation-redesign
**Date:** 2026-06-15

---

## 1. Complete Route Inventory

| Path | Component | Lazy | Type | Status |
|------|-----------|------|------|--------|
| `` (root) | `HomePage` | Yes | shared | active |
| `file-analysis` | `FileAnalysisPage` | Yes | file | active |
| `file-analysis/architecture` | `FileArchitecturePage` | Yes | file | active |
| `file-analysis/data-flow` | `FileDataFlowPage` | Yes | file | active |
| `file-analysis/code-recommendations` | `FileCodeRecommendationsPage` | Yes | file | active |
| `file-analysis/security` | `FileSecurityPage` | Yes | file | active |
| `file-analysis/documentation` | `FileDocumentationPage` | Yes | file | active |
| `file-analysis/system-understanding` | `FileSystemUnderstandingPage` | Yes | file | active |
| `file-analysis/learning-path` | `FileLearningPathPage` | Yes | file | active |
| `folder-analysis` | `FolderAnalysisPage` | Yes | folder | active |
| `folder-analysis/architecture` | `FolderArchitecturePage` | Yes | folder | active |
| `folder-analysis/data-flow` | `FolderDataFlowPage` | Yes | folder | active |
| `folder-analysis/code-recommendations` | `FolderCodeRecommendationsPage` | Yes | folder | active |
| `folder-analysis/security` | `FolderSecurityPage` | Yes | folder | active |
| `folder-analysis/documentation` | `FolderDocumentationPage` | Yes | folder | active |
| `folder-analysis/system-understanding` | `FolderSystemUnderstandingPage` | Yes | folder | active |
| `folder-analysis/learning-path` | `FolderLearningPathPage` | Yes | folder | active |
| `repository-analysis` | `RepositoryAnalysisPage` | Yes | repository | active |
| `repository-analysis/architecture` | `RepositoryArchitecturePage` | Yes | repository | active |
| `repository-analysis/data-flow` | `RepositoryDataFlowPage` | Yes | repository | active |
| `repository-analysis/code-recommendations` | `RepositoryCodeRecommendationsPage` | Yes | repository | active |
| `repository-analysis/security` | `RepositorySecurityPage` | Yes | repository | active |
| `repository-analysis/documentation` | `RepositoryDocumentationPage` | Yes | repository | active |
| `repository-analysis/system-understanding` | `RepositorySystemUnderstandingPage` | Yes | repository | active |
| `repository-analysis/learning-path` | `RepositoryLearningPathPage` | Yes | repository | active |
| `settings` | `SettingsPage` | Yes | shared | active |
| `analysis` | redirect → `file-analysis` | No | file | orphaned |
| `architecture` | redirect → `file-analysis/architecture` | No | file | orphaned |
| `data-flow` | redirect → `file-analysis/data-flow` | No | file | orphaned |
| `risks` | redirect → `file-analysis/code-recommendations` | No | file | orphaned |
| `modernization` | redirect → `file-analysis/code-recommendations` | No | file | orphaned |
| `security` | redirect → `file-analysis/security` | No | file | orphaned |
| `documentation` | redirect → `file-analysis/documentation` | No | file | orphaned |
| `history` | redirect → `(root)` | No | shared | orphaned |
| `repository-navigation` | redirect → `repository-analysis` | No | repository | orphaned |
| `nav-playground` | redirect → `repository-analysis` | No | repository | orphaned |
| `**` | redirect → `(root)` | No | shared | active |

**Total routes defined: 37** (26 active page routes + 10 orphaned legacy redirects + 1 wildcard catch-all)

---

## 2. Sidebar-Linked Routes vs Total Routes

| Metric | Count |
|--------|-------|
| Total routes defined | 37 |
| Active page routes (lazy-loaded components) | 26 |
| Sidebar-linked routes | 27 |
| Active routes NOT in sidebar | 0 |
| Orphaned/redirect routes (not sidebar-linked) | 10 |

All 26 active lazy-loaded page routes are reachable from the sidebar. The sidebar additionally links `/` (root/`HomePage`), giving 27 sidebar links total. No active page route is sidebar-dark (unreachable from the nav).

### Sidebar Link List

| Sidebar Link | Maps To |
|--------------|---------|
| `/` | `HomePage` |
| `/file-analysis` | `FileAnalysisPage` |
| `/file-analysis/system-understanding` | `FileSystemUnderstandingPage` |
| `/file-analysis/learning-path` | `FileLearningPathPage` |
| `/file-analysis/architecture` | `FileArchitecturePage` |
| `/file-analysis/data-flow` | `FileDataFlowPage` |
| `/file-analysis/security` | `FileSecurityPage` |
| `/file-analysis/code-recommendations` | `FileCodeRecommendationsPage` |
| `/file-analysis/documentation` | `FileDocumentationPage` |
| `/folder-analysis` | `FolderAnalysisPage` |
| `/folder-analysis/system-understanding` | `FolderSystemUnderstandingPage` |
| `/folder-analysis/learning-path` | `FolderLearningPathPage` |
| `/folder-analysis/architecture` | `FolderArchitecturePage` |
| `/folder-analysis/data-flow` | `FolderDataFlowPage` |
| `/folder-analysis/security` | `FolderSecurityPage` |
| `/folder-analysis/code-recommendations` | `FolderCodeRecommendationsPage` |
| `/folder-analysis/documentation` | `FolderDocumentationPage` |
| `/repository-analysis` | `RepositoryAnalysisPage` |
| `/repository-analysis/system-understanding` | `RepositorySystemUnderstandingPage` |
| `/repository-analysis/learning-path` | `RepositoryLearningPathPage` |
| `/repository-analysis/architecture` | `RepositoryArchitecturePage` |
| `/repository-analysis/data-flow` | `RepositoryDataFlowPage` |
| `/repository-analysis/security` | `RepositorySecurityPage` |
| `/repository-analysis/code-recommendations` | `RepositoryCodeRecommendationsPage` |
| `/repository-analysis/documentation` | `RepositoryDocumentationPage` |
| `/settings` | `SettingsPage` |

---

## 3. Orphaned Routes

These routes are defined in the router but are not linked from any sidebar section. They exist solely to preserve old bookmarks and are all implemented as redirects to current routes.

| Path | Redirects To | Origin / Reason |
|------|-------------|-----------------|
| `analysis` | `file-analysis` | Pre-workspace-split entry point |
| `architecture` | `file-analysis/architecture` | Pre-workspace-split page |
| `data-flow` | `file-analysis/data-flow` | Pre-workspace-split page |
| `risks` | `file-analysis/code-recommendations` | Renamed from "Risks" to "Recommendations" |
| `modernization` | `file-analysis/code-recommendations` | Former "Modernization" page, consolidated |
| `security` | `file-analysis/security` | Pre-workspace-split page |
| `documentation` | `file-analysis/documentation` | Pre-workspace-split page |
| `history` | `(root)` | History page removed from the app |
| `repository-navigation` | `repository-analysis` | Stage 8 route before workspace rename |
| `nav-playground` | `repository-analysis` | Stage 8 developer playground route |

**Notes:**
- All 10 orphaned routes are redirects — no orphaned route renders a component directly.
- `history` and `nav-playground` redirect to root/repository-analysis respectively; the pages they once pointed to no longer exist.
- These can be safely removed if backward-compatibility with old bookmarks is no longer required. Removal would reduce router noise but carries no functional risk.

---

## 4. Dead Routes

A dead route is one that is defined in the router but points to a page component that no longer exists in the codebase.

| Path | Issue |
|------|-------|
| `history` | Redirects to root because the History page was removed. The route itself is a redirect so no component is missing, but the original destination is gone. |
| `nav-playground` | Redirects to `repository-analysis` because the playground page was removed after Stage 8. Same as above — the route is a redirect, not a dangling component reference. |

**Conclusion:** There are no dead routes in the sense of a route referencing a missing component. All lazy-loaded components exist. The two routes above (`history`, `nav-playground`) are legacy redirects whose original destination pages were intentionally deleted; the redirects themselves are valid.
