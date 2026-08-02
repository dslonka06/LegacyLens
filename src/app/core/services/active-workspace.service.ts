import { Injectable } from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';

export type ActiveWorkspace = 'file' | 'folder' | 'repository' | 'settings' | 'library' | null;

@Injectable({ providedIn: 'root' })
export class ActiveWorkspaceService {
  private readonly _workspace$ = new BehaviorSubject<ActiveWorkspace>(null);
  readonly workspace$ = this._workspace$.asObservable();

  constructor(private readonly router: Router) {
    // Update optimistically on NavigationStart so the sidebar reflects the
    // destination immediately, even while an async guard is still running.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe((e: NavigationStart) => {
        this._workspace$.next(this.detectWorkspace(e.url));
      });

    // Correct to urlAfterRedirects once navigation commits (handles guard redirects).
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this._workspace$.next(this.detectWorkspace(e.urlAfterRedirects));
      });

    // Sync on construction in case we're already on a workspace route
    this._workspace$.next(this.detectWorkspace(this.router.url));
  }

  get workspace(): ActiveWorkspace {
    return this._workspace$.getValue();
  }

  private detectWorkspace(url: string): ActiveWorkspace {
    // Strip query string before matching
    const path = url.split('?')[0];
    if (path.startsWith('/file-analysis')) return 'file';
    if (path.startsWith('/folder-analysis')) return 'folder';
    if (path.startsWith('/repository-analysis')) return 'repository';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/library')) return 'library';
    return null;
  }
}
