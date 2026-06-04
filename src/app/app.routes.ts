import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'analysis',
    pathMatch: 'full'
  },
  {
    path: 'analysis',
    loadComponent: () =>
      import('./pages/analysis-page/analysis-page').then(m => m.AnalysisPage)
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history-page/history-page').then(m => m.HistoryPage)
  },
  {
    path: 'data-flow',
    loadComponent: () =>
      import('./pages/data-flow-page/data-flow-page').then(m => m.DataFlowPage)
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./pages/architecture-page/architecture-page').then(m => m.ArchitecturePage)
  },
  {
    path: 'risks',
    loadComponent: () =>
      import('./pages/risks-page/risks-page').then(m => m.RisksPage)
  },
  {
    path: 'modernization',
    loadComponent: () =>
      import('./pages/modernization-page/modernization-page').then(m => m.ModernizationPage)
  },
  {
    path: 'documentation',
    loadComponent: () =>
      import('./pages/documentation-page/documentation-page').then(m => m.DocumentationPage)
  },
  {
    path: 'security',
    loadComponent: () =>
      import('./pages/security-page/security-page').then(m => m.SecurityPage)
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings-page/settings-page').then(m => m.SettingsPage)
  },
  {
    path: '**',
    redirectTo: 'analysis'
  }
];
