import { Routes } from '@angular/router';
import { workspaceInitGuard } from './guards/workspace-init.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-page/home-page').then(m => m.HomePage)
  },

  // ── File Analysis workspace ────────────────────────────────────────────────
  {
    path: 'file-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/file-analysis-page/file-analysis-page').then(m => m.FileAnalysisPage)
  },
  {
    path: 'file-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/file-architecture-page/file-architecture-page').then(m => m.FileArchitecturePage)
  },
  {
    path: 'file-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/file-data-flow-page/file-data-flow-page').then(m => m.FileDataFlowPage)
  },
  {
    path: 'file-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/file-code-recommendations-page/file-code-recommendations-page').then(m => m.FileCodeRecommendationsPage)
  },
  {
    path: 'file-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/file-documentation-page/file-documentation-page').then(m => m.FileDocumentationPage)
  },
  {
    path: 'file-analysis/changes',
    canActivate: [workspaceInitGuard],
    data: { scope: 'file' },
    loadComponent: () =>
      import('./components/changes-page/changes-page').then(m => m.ChangesPageComponent)
  },

  // ── Folder Analysis workspace ─────────────────────────────────────────────
  {
    path: 'folder-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/folder-analysis-page/folder-analysis-page').then(m => m.FolderAnalysisPage)
  },
  {
    path: 'folder-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/folder-architecture-page/folder-architecture-page').then(m => m.FolderArchitecturePage)
  },
  {
    path: 'folder-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/folder-data-flow-page/folder-data-flow-page').then(m => m.FolderDataFlowPage)
  },
  {
    path: 'folder-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/folder-code-recommendations-page/folder-code-recommendations-page').then(m => m.FolderCodeRecommendationsPage)
  },
  {
    path: 'folder-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/folder-documentation-page/folder-documentation-page').then(m => m.FolderDocumentationPage)
  },
  {
    path: 'folder-analysis/changes',
    canActivate: [workspaceInitGuard],
    data: { scope: 'folder' },
    loadComponent: () =>
      import('./components/changes-page/changes-page').then(m => m.ChangesPageComponent)
  },

  // ── Repository Analysis workspace ──────────────────────────────────────────
  {
    path: 'repository-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/repository-analysis-page/repository-analysis-page').then(m => m.RepositoryAnalysisPage)
  },
  {
    path: 'repository-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/repository-architecture-page/repository-architecture-page').then(m => m.RepositoryArchitecturePage)
  },
  {
    path: 'repository-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/repository-data-flow-page/repository-data-flow-page').then(m => m.RepositoryDataFlowPage)
  },
  {
    path: 'repository-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/repository-code-recommendations-page/repository-code-recommendations-page').then(m => m.RepositoryCodeRecommendationsPage)
  },
  {
    path: 'repository-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('./pages/repository-documentation-page/repository-documentation-page').then(m => m.RepositoryDocumentationPage)
  },
  {
    path: 'repository-analysis/changes',
    canActivate: [workspaceInitGuard],
    data: { scope: 'repository' },
    loadComponent: () =>
      import('./components/changes-page/changes-page').then(m => m.ChangesPageComponent)
  },

  // ── Global ─────────────────────────────────────────────────────────────────
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings-page/settings-page').then(m => m.SettingsPage)
  },

  // ── Legacy redirects (preserve bookmarks / deep links) ────────────────────
  { path: 'analysis',              redirectTo: 'file-analysis',                   pathMatch: 'full' },
  { path: 'architecture',          redirectTo: 'file-analysis/architecture',       pathMatch: 'full' },
  { path: 'data-flow',             redirectTo: 'file-analysis/data-flow',          pathMatch: 'full' },
  { path: 'risks',                 redirectTo: 'file-analysis/code-recommendations', pathMatch: 'full' },
  { path: 'modernization',         redirectTo: 'file-analysis/code-recommendations', pathMatch: 'full' },
  { path: 'security',              redirectTo: 'file-analysis/code-recommendations', pathMatch: 'full' },
  { path: 'documentation',         redirectTo: 'file-analysis/documentation',      pathMatch: 'full' },
  { path: 'history',               redirectTo: '',                                  pathMatch: 'full' },
  { path: 'repository-navigation', redirectTo: 'repository-analysis',              pathMatch: 'full' },
  { path: 'nav-playground',        redirectTo: 'repository-analysis',              pathMatch: 'full' },

  { path: '**', redirectTo: '' }
];
