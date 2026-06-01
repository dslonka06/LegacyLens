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
    path: 'documentation',
    loadComponent: () =>
      import('./pages/documentation-page/documentation-page').then(m => m.DocumentationPage)
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./pages/architecture-page/architecture-page').then(m => m.ArchitecturePage)
  },
  {
    path: 'data-flow',
    loadComponent: () =>
      import('./pages/data-flow-page/data-flow-page').then(m => m.DataFlowPage)
  },
  {
    path: 'security',
    loadComponent: () =>
      import('./pages/security-page/security-page').then(m => m.SecurityPage)
  },
  {
    path: 'explain-simpler',
    loadComponent: () =>
      import('./pages/explain-simpler-page/explain-simpler-page').then(m => m.ExplainSimplerPage)
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history-page/history-page').then(m => m.HistoryPage)
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings-page/settings-page').then(m => m.SettingsPage)
  },
  {
    path: 'feedback',
    loadComponent: () =>
      import('./pages/feedback-page/feedback-page').then(m => m.FeedbackPage)
  },
  {
    path: '**',
    redirectTo: 'analysis'
  }
];
