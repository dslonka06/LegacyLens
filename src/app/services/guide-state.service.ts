import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GuideRecommendation } from '../models/guide.model';

const DISMISSED_KEY = 'legacylens-guide-dismissed';

@Injectable({ providedIn: 'root' })
export class GuideStateService {

  private readonly _isOpen$ = new BehaviorSubject<boolean>(false);
  private readonly _recommendation$ = new BehaviorSubject<GuideRecommendation | null>(null);
  private readonly _completed$ = new BehaviorSubject<boolean>(false);

  readonly isOpen$ = this._isOpen$.asObservable();
  readonly recommendation$ = this._recommendation$.asObservable();
  readonly completed$ = this._completed$.asObservable();

  get isOpen(): boolean { return this._isOpen$.value; }
  get recommendation(): GuideRecommendation | null { return this._recommendation$.value; }
  get isDismissed(): boolean { return localStorage.getItem(DISMISSED_KEY) === 'true'; }
  get hasCompleted(): boolean { return this._completed$.value; }

  open(): void {
    this._isOpen$.next(true);
  }

  close(): void {
    this._isOpen$.next(false);
  }

  dismiss(permanently: boolean): void {
    if (permanently) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    this.close();
  }

  setRecommendation(recommendation: GuideRecommendation): void {
    this._recommendation$.next(recommendation);
    this._completed$.next(true);
  }

  reset(): void {
    this._recommendation$.next(null);
    this._completed$.next(false);
  }

  // Called once on app init — shows guide automatically on first visit
  checkFirstLaunch(): void {
    if (!this.isDismissed) {
      this.open();
    }
  }
}
