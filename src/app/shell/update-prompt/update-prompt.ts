import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { UpdateService, UpdateState, UpdateInfo } from '@app/core/services/update.service';

@Component({
  selector: 'app-update-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './update-prompt.html',
  styleUrl: './update-prompt.scss',
})
export class UpdatePrompt implements OnInit, OnDestroy {

  state:    UpdateState  = 'idle';
  info:     UpdateInfo | null = null;
  progress = 0;
  dismissed = false;

  private sub: Subscription | null = null;

  constructor(readonly updateService: UpdateService) {}

  ngOnInit(): void {
    this.sub = combineLatest([
      this.updateService.state$,
      this.updateService.info$,
      this.updateService.progress$,
    ]).subscribe(([state, info, progress]) => {
      this.state    = state;
      this.info     = info;
      this.progress = progress;
      // Un-dismiss if a new update arrives after the user dismissed a previous one
      if (state === 'available' || state === 'ready') this.dismissed = false;
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get visible(): boolean {
    if (this.dismissed) return false;
    return this.state === 'available' || this.state === 'downloading' || this.state === 'ready';
  }

  download(): void  { this.updateService.downloadUpdate(); }
  install(): void   { this.updateService.installAndRestart(); }
  dismiss(): void   { this.dismissed = true; }
}
