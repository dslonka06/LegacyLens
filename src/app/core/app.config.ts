import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AnalysisPersistenceService } from '@app/analysis/services/analysis-persistence.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    // Force instantiation of AnalysisPersistenceService at app startup so it
    // begins watching workspace state immediately, before any page loads.
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: AnalysisPersistenceService) => () => {},
      deps: [AnalysisPersistenceService],
      multi: true,
    },
  ]
};
