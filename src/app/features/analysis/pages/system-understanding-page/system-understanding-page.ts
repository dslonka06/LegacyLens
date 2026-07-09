import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { SystemUnderstanding } from '@app/analysis/models/system-understanding.model';
import { ExplanationCard } from '@app/shared/components/explanation-card/explanation-card';

@Component({
  selector: 'app-system-understanding-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ExplanationCard],
  templateUrl: './system-understanding-page.html',
  styleUrl: './system-understanding-page.scss',
})
export class SystemUnderstandingPage implements OnInit, OnDestroy {

  understanding: SystemUnderstanding | null = null;
  hasWorkspace = false;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.hasWorkspace  = ws !== null;
      this.understanding = ws?.knowledgeModel?.ai?.understanding ?? null;
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get showExplanationCard(): boolean {
    return this.hasWorkspace && this.understanding !== null;
  }

  depTypeLabel(type: string): string {
    const map: Record<string, string> = {
      framework: 'Framework', database: 'Database', queue: 'Queue',
      storage: 'Storage',     external: 'External',  internal: 'Internal',
    };
    return map[type] ?? type;
  }
}
