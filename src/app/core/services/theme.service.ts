import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'legacylens-theme';
  private readonly _isDark = new BehaviorSubject<boolean>(this.loadPreference());

  readonly isDark$ = this._isDark.asObservable();

  get isDark(): boolean {
    return this._isDark.value;
  }

  constructor() {
    this.applyTheme(this._isDark.value);
  }

  toggle(): void {
    const next = !this._isDark.value;
    this._isDark.next(next);
    this.applyTheme(next);
    localStorage.setItem(this.STORAGE_KEY, next ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean): void {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
