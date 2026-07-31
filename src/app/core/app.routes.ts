import { Routes } from '@angular/router';
import { workspaceInitGuard } from '@app/core/guards/workspace-init.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../shared/pages/home-page/home-page').then((m) => m.HomePage),
  },

  // ── File Analysis workspace ────────────────────────────────────────────────
  {
    path: 'file-analysis/new',
    loadComponent: () =>
      import('../features/file-analysis/pages/file-analysis-new-page/file-analysis-new-page').then(
        (m) => m.FileAnalysisNewPage,
      ),
  },
  {
    path: 'file-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-analysis-page/file-analysis-page').then(
        (m) => m.FileAnalysisPage,
      ),
  },
  {
    path: 'file-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/data-flow-page/data-flow-page').then(
        (m) => m.DataFlowPage,
      ),
  },
  {
    path: 'file-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/code-recommendations-page/code-recommendations-page').then(
        (m) => m.CodeRecommendationsPage,
      ),
  },
  {
    path: 'file-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/security-page/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'file-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/documentation-page/documentation-page').then(
        (m) => m.DocumentationPage,
      ),
  },
  {
    path: 'file-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/system-understanding-page/system-understanding-page').then(
        (m) => m.SystemUnderstandingPage,
      ),
  },
  {
    path: 'file-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/learning-path-page/learning-path-page').then(
        (m) => m.LearningPathPage,
      ),
  },

  // ── Folder Analysis workspace ─────────────────────────────────────────────
  {
    path: 'folder-analysis/new',
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-analysis-new-page/folder-analysis-new-page').then(
        (m) => m.FolderAnalysisNewPage,
      ),
  },
  {
    path: 'folder-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-analysis-page/folder-analysis-page').then(
        (m) => m.FolderAnalysisPage,
      ),
  },
  {
    path: 'folder-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/architecture-page/architecture-page').then(
        (m) => m.ArchitecturePage,
      ),
  },
  {
    path: 'folder-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/data-flow-page/data-flow-page').then(
        (m) => m.DataFlowPage,
      ),
  },
  {
    path: 'folder-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/code-recommendations-page/code-recommendations-page').then(
        (m) => m.CodeRecommendationsPage,
      ),
  },
  {
    path: 'folder-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/security-page/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'folder-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/documentation-page/documentation-page').then(
        (m) => m.DocumentationPage,
      ),
  },
  {
    path: 'folder-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/system-understanding-page/system-understanding-page').then(
        (m) => m.SystemUnderstandingPage,
      ),
  },
  {
    path: 'folder-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/learning-path-page/learning-path-page').then(
        (m) => m.LearningPathPage,
      ),
  },

  // ── Repository Analysis workspace ──────────────────────────────────────────
  {
    path: 'repository-analysis/new',
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-analysis-new-page/repository-analysis-new-page').then(
        (m) => m.RepositoryAnalysisNewPage,
      ),
  },
  {
    path: 'repository-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-analysis-page/repository-analysis-page').then(
        (m) => m.RepositoryAnalysisPage,
      ),
  },
  {
    path: 'repository-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/architecture-page/architecture-page').then(
        (m) => m.ArchitecturePage,
      ),
  },
  {
    path: 'repository-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/data-flow-page/data-flow-page').then(
        (m) => m.DataFlowPage,
      ),
  },
  {
    path: 'repository-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/code-recommendations-page/code-recommendations-page').then(
        (m) => m.CodeRecommendationsPage,
      ),
  },
  {
    path: 'repository-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/security-page/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'repository-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/documentation-page/documentation-page').then(
        (m) => m.DocumentationPage,
      ),
  },
  {
    path: 'repository-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/system-understanding-page/system-understanding-page').then(
        (m) => m.SystemUnderstandingPage,
      ),
  },
  {
    path: 'repository-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/analysis/pages/learning-path-page/learning-path-page').then(
        (m) => m.LearningPathPage,
      ),
  },

  // ── Global ─────────────────────────────────────────────────────────────────
  {
    path: 'library',
    loadComponent: () =>
      import('../features/library/pages/library-page/library-page').then((m) => m.LibraryPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('../features/settings/pages/settings-page/settings-page').then((m) => m.SettingsPage),
  },

  { path: '**', redirectTo: '' },
];
