import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly _open = new BehaviorSubject<boolean>(false);
  readonly open$ = this._open.asObservable();

  get open(): boolean {
    return this._open.value;
  }

  toggle(): void {
    this._open.next(!this._open.value);
  }

  close(): void {
    this._open.next(false);
  }
}
