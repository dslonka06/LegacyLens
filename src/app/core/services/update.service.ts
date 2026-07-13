import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import type {
  UpdateAvailablePayload,
  DownloadProgressPayload,
  UpdateDownloadedPayload,
} from '../../../electron';

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateInfo {
  version: string;
  releaseNotes: string | null;
}

@Injectable({ providedIn: 'root' })
export class UpdateService implements OnDestroy {
  private readonly _state$ = new BehaviorSubject<UpdateState>('idle');
  private readonly _info$ = new BehaviorSubject<UpdateInfo | null>(null);
  private readonly _progress$ = new BehaviorSubject<number>(0);
  private readonly _error$ = new Subject<string>();

  readonly state$ = this._state$.asObservable();
  readonly info$ = this._info$.asObservable();
  readonly progress$ = this._progress$.asObservable();
  readonly error$ = this._error$.asObservable();

  private unsubs: Array<() => void> = [];

  constructor(private readonly zone: NgZone) {
    this.wireListeners();
  }

  ngOnDestroy(): void {
    this.unsubs.forEach((fn) => fn());
  }

  get isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI?.updater;
  }

  checkForUpdates(): void {
    if (!this.isElectron) return;
    this._state$.next('checking');
    window.electronAPI!.updater.checkForUpdates().catch(() => {
      this.zone.run(() => this._state$.next('idle'));
    });
  }

  downloadUpdate(): void {
    if (!this.isElectron) return;
    this._state$.next('downloading');
    this._progress$.next(0);
    window.electronAPI!.updater.downloadUpdate().catch(() => {
      this.zone.run(() => this._state$.next('available'));
    });
  }

  installAndRestart(): void {
    if (!this.isElectron) return;
    window.electronAPI!.updater.installAndRestart().catch(() => {});
  }

  private wireListeners(): void {
    if (!this.isElectron) return;
    const api = window.electronAPI!.updater;

    this.unsubs.push(
      api.onUpdateAvailable((payload: UpdateAvailablePayload) => {
        this.zone.run(() => {
          this._info$.next({ version: payload.version, releaseNotes: payload.releaseNotes });
          this._state$.next('available');
        });
      }),

      api.onUpdateNotAvailable(() => {
        this.zone.run(() => {
          if (this._state$.value === 'checking') this._state$.next('idle');
        });
      }),

      api.onDownloadProgress((payload: DownloadProgressPayload) => {
        this.zone.run(() => {
          this._progress$.next(payload.percent);
          if (this._state$.value !== 'downloading') this._state$.next('downloading');
        });
      }),

      api.onUpdateDownloaded((payload: UpdateDownloadedPayload) => {
        this.zone.run(() => {
          this._info$.next({
            version: payload.version,
            releaseNotes: this._info$.value?.releaseNotes ?? null,
          });
          this._state$.next('ready');
        });
      }),
    );
  }
}
