import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';

export type ActiveWorkspace = 'file' | 'folder' | 'repository' | null;

@Injectable({ providedIn: 'root' })
export class ActiveWorkspaceService {

  private readonly _workspace$ = new BehaviorSubject<ActiveWorkspace>(null);
  readonly workspace$ = this._workspace$.asObservable();

  constructor(private readonly router: Router) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
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
    if (url.startsWith('/file-analysis'))       return 'file';
    if (url.startsWith('/folder-analysis'))     return 'folder';
    if (url.startsWith('/repository-analysis')) return 'repository';
    return null;
  }
}
