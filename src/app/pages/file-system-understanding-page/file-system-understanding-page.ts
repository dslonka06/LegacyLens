import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import {
  SystemUnderstanding,
  CriticalityLevel,
  HealthLevel,
} from '../../models/system-understanding.model';

@Component({
  selector: 'app-file-system-understanding-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-system-understanding-page.html',
  styleUrl: './file-system-understanding-page.scss',
})
export class FileSystemUnderstandingPage implements OnInit, OnDestroy {

  understanding: SystemUnderstanding | null = null;
  hasWorkspace = false;

  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
      this.hasWorkspace = ws !== null;
      this.understanding = ws?.systemUnderstanding ?? null;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  criticalityClass(level: CriticalityLevel): string {
    return ({
      Critical: 'crit-critical',
      High:     'crit-high',
      Medium:   'crit-medium',
      Low:      'crit-low',
    } as Record<CriticalityLevel, string>)[level] ?? 'crit-low';
  }

  healthClass(level: HealthLevel): string {
    return ({
      High:   'health-high',
      Medium: 'health-medium',
      Low:    'health-low',
    } as Record<HealthLevel, string>)[level] ?? 'health-medium';
  }

  healthIcon(level: HealthLevel): string {
    if (level === 'High')   return '↑';
    if (level === 'Medium') return '→';
    return '↓';
  }
}
