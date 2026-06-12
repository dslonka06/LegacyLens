import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {

  private readonly _isDirty$ = new BehaviorSubject<boolean>(false);
  readonly isDirty$ = this._isDirty$.asObservable();

  get isDirty(): boolean { return this._isDirty$.value; }

  set(dirty: boolean): void { this._isDirty$.next(dirty); }

  clear(): void { this._isDirty$.next(false); }

  confirm(): boolean {
    if (!this._isDirty$.value) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  }
}
