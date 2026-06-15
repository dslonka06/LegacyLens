import { Routes } from '@angular/router';
import { workspaceInitGuard } from '@app/core/guards/workspace-init.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../shared/pages/home-page/home-page').then(m => m.HomePage)
  },

  // ── File Analysis workspace ────────────────────────────────────────────────
  {
    path: 'file-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-analysis-page/file-analysis-page').then(m => m.FileAnalysisPage)
  },
  {
    path: 'file-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-architecture-page/file-architecture-page').then(m => m.FileArchitecturePage)
  },
  {
    path: 'file-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-data-flow-page/file-data-flow-page').then(m => m.FileDataFlowPage)
  },
  {
    path: 'file-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-code-recommendations-page/file-code-recommendations-page').then(m => m.FileCodeRecommendationsPage)
  },
  {
    path: 'file-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-security-page/file-security-page').then(m => m.FileSecurityPage)
  },
  {
    path: 'file-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-documentation-page/file-documentation-page').then(m => m.FileDocumentationPage)
  },
  {
    path: 'file-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-system-understanding-page/file-system-understanding-page').then(m => m.FileSystemUnderstandingPage)
  },
  {
    path: 'file-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/file-analysis/pages/file-learning-path-page/file-learning-path-page').then(m => m.FileLearningPathPage)
  },
  // ── Folder Analysis workspace ─────────────────────────────────────────────
  {
    path: 'folder-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-analysis-page/folder-analysis-page').then(m => m.FolderAnalysisPage)
  },
  {
    path: 'folder-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-architecture-page/folder-architecture-page').then(m => m.FolderArchitecturePage)
  },
  {
    path: 'folder-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-data-flow-page/folder-data-flow-page').then(m => m.FolderDataFlowPage)
  },
  {
    path: 'folder-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-code-recommendations-page/folder-code-recommendations-page').then(m => m.FolderCodeRecommendationsPage)
  },
  {
    path: 'folder-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-security-page/folder-security-page').then(m => m.FolderSecurityPage)
  },
  {
    path: 'folder-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-documentation-page/folder-documentation-page').then(m => m.FolderDocumentationPage)
  },
  {
    path: 'folder-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-system-understanding-page/folder-system-understanding-page').then(m => m.FolderSystemUnderstandingPage)
  },
  {
    path: 'folder-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/folder-analysis/pages/folder-learning-path-page/folder-learning-path-page').then(m => m.FolderLearningPathPage)
  },
  // ── Repository Analysis workspace ──────────────────────────────────────────
  {
    path: 'repository-analysis',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-analysis-page/repository-analysis-page').then(m => m.RepositoryAnalysisPage)
  },
  {
    path: 'repository-analysis/architecture',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-architecture-page/repository-architecture-page').then(m => m.RepositoryArchitecturePage)
  },
  {
    path: 'repository-analysis/data-flow',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-data-flow-page/repository-data-flow-page').then(m => m.RepositoryDataFlowPage)
  },
  {
    path: 'repository-analysis/code-recommendations',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-code-recommendations-page/repository-code-recommendations-page').then(m => m.RepositoryCodeRecommendationsPage)
  },
  {
    path: 'repository-analysis/security',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-security-page/repository-security-page').then(m => m.RepositorySecurityPage)
  },
  {
    path: 'repository-analysis/documentation',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-documentation-page/repository-documentation-page').then(m => m.RepositoryDocumentationPage)
  },
  {
    path: 'repository-analysis/system-understanding',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-system-understanding-page/repository-system-understanding-page').then(m => m.RepositorySystemUnderstandingPage)
  },
  {
    path: 'repository-analysis/learning-path',
    canActivate: [workspaceInitGuard],
    loadComponent: () =>
      import('../features/repository-analysis/pages/repository-learning-path-page/repository-learning-path-page').then(m => m.RepositoryLearningPathPage)
  },
  // ── Global ─────────────────────────────────────────────────────────────────
  {
    path: 'settings',
    loadComponent: () =>
      import('../features/settings/pages/settings-page/settings-page').then(m => m.SettingsPage)
  },

  { path: '**', redirectTo: '' }
];
