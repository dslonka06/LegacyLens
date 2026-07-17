import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly STORAGE_KEY = 'systemlens-sidebar-collapsed';
  private readonly _collapsed = new BehaviorSubject<boolean>(this.loadPreference());

  readonly collapsed$ = this._collapsed.asObservable();

  get collapsed(): boolean {
    return this._collapsed.value;
  }

  toggle(): void {
    this.setCollapsed(!this._collapsed.value);
  }

  expand(): void {
    this.setCollapsed(false);
  }

  private setCollapsed(value: boolean): void {
    this._collapsed.next(value);
    try {
      localStorage.setItem(this.STORAGE_KEY, value ? '1' : '0');
    } catch {
      // localStorage unavailable — degrade silently
    }
  }

  private loadPreference(): boolean {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      // Default is collapsed (icon-only); stored '0' means user expanded it
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  }
}
