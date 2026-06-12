import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '../../services/workspace-manager.service';
import { SystemUnderstanding } from '../../models/system-understanding.model';

@Component({
  selector: 'app-folder-system-understanding-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './folder-system-understanding-page.html',
  styleUrl: './folder-system-understanding-page.scss',
})
export class FolderSystemUnderstandingPage implements OnInit, OnDestroy {

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
}
