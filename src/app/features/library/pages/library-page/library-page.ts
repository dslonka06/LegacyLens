import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';
import { Workspace, WorkspaceType } from '@app/workspace/models/workspace-entity.model';

type TypeFilter = 'all' | WorkspaceType;
type SortKey = 'lastModified' | 'name' | 'created';
type StatusFilter = 'all' | 'ready' | 'failed';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeToggle],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class LibraryPage implements OnInit, OnDestroy {
  search = '';
  typeFilter: TypeFilter = 'all';
  sortKey: SortKey = 'lastModified';
  statusFilter: StatusFilter = 'all';
  confirmDeleteId: string | null = null;

  private all: Workspace[] = [];
  filtered: Workspace[] = [];

  private subs: Subscription[] = [];

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Pre-select type filter from query param (e.g. ?type=file from hub Manage button)
    const type = this.route.snapshot.queryParamMap.get('type') as TypeFilter | null;
    if (type && ['file', 'folder', 'repository'].includes(type)) {
      this.typeFilter = type;
    }

    this.subs.push(
      this.manager.workspaces$.subscribe((ws) => {
        this.all = ws;
        this.applyFilters();
        this.cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  setType(type: TypeFilter): void {
    this.typeFilter = type;
    this.applyFilters();
  }

  setSort(key: SortKey): void {
    this.sortKey = key;
    this.applyFilters();
  }

  setStatus(status: StatusFilter): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  openWorkspace(ws: Workspace): void {
    this.manager.activate(ws.id);
  }

  confirmDelete(id: string, event: Event): void {
    event.stopPropagation();
    this.confirmDeleteId = id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  deleteWorkspace(id: string, event: Event): void {
    event.stopPropagation();
    this.manager.delete(id);
    this.confirmDeleteId = null;
  }

  typeLabel(type: WorkspaceType): string {
    if (type === 'file') return 'File';
    if (type === 'folder') return 'Folder';
    return 'Repository';
  }

  statusLabel(ws: Workspace): string {
    if (ws.status === 'ready') return 'Ready';
    if (ws.status === 'failed' || ws.status === 'error') return 'Failed';
    if (ws.status === 'processing') return 'Analyzing';
    return 'Empty';
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  }

  summary(ws: Workspace): string {
    return ws.knowledgeModel?.ai?.understanding?.executiveSummary ?? '';
  }

  languages(ws: Workspace): string[] {
    const langs = ws.knowledgeModel?.structure?.languages;
    if (!langs?.length) return [];
    return langs.slice(0, 3);
  }

  get hasResults(): boolean {
    return this.filtered.length > 0;
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  private applyFilters(): void {
    let result = [...this.all];

    // Exclude empty workspaces from the library — nothing to show
    result = result.filter((w) => w.status !== 'empty');

    if (this.typeFilter !== 'all') {
      result = result.filter((w) => w.type === this.typeFilter);
    }

    if (this.statusFilter === 'ready') {
      result = result.filter((w) => w.status === 'ready');
    } else if (this.statusFilter === 'failed') {
      result = result.filter((w) => w.status === 'failed' || w.status === 'error');
    }

    const q = this.search.trim().toLowerCase();
    if (q) {
      result = result.filter((w) => w.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (this.sortKey === 'name') return a.name.localeCompare(b.name);
      if (this.sortKey === 'created') return a.createdAt.localeCompare(b.createdAt) * -1;
      return b.lastModifiedAt.localeCompare(a.lastModifiedAt);
    });

    this.filtered = result;
  }
}
