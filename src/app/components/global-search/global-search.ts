import {
  Component, OnDestroy, HostListener, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RepositorySearchService } from '../../services/repository-search.service';
import { NavigationContextService } from '../../services/navigation-context.service';
import { RepositoryKnowledgeService } from '../../services/repository-knowledge.service';
import { SearchResult, SearchResultType } from '../../models/search-result.model';
import { DependencyNode } from '../../models/knowledge.model';

// Display group in the results panel
interface ResultGroup {
  label: string;
  icon: string;
  results: SearchResult[];
}

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss',
})
export class GlobalSearch implements OnDestroy {

  query = '';
  isOpen = false;
  groups: ResultGroup[] = [];
  activeIndex = -1;       // flat index across all visible results for keyboard nav
  flatResults: SearchResult[] = [];

  private readonly query$ = new Subject<string>();
  private subs: Subscription[] = [];

  constructor(
    private readonly search: RepositorySearchService,
    private readonly nav: NavigationContextService,
    private readonly knowledge: RepositoryKnowledgeService,
    private readonly router: Router,
    private readonly el: ElementRef,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.subs.push(
      this.query$.pipe(
        debounceTime(120),
        distinctUntilChanged(),
      ).subscribe(q => this.runSearch(q))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Input handling ────────────────────────────────────────────────────────

  onQueryChange(value: string): void {
    this.query = value;
    if (value.trim().length >= 2) {
      this.isOpen = true;
      this.query$.next(value);
    } else {
      this.closePanel();
    }
  }

  onFocus(): void {
    if (this.query.trim().length >= 2) {
      this.isOpen = true;
      this.runSearch(this.query);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Cmd/Ctrl+K focuses the search bar
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      const input = this.el.nativeElement.querySelector('.gs-input') as HTMLInputElement | null;
      input?.focus();
      return;
    }

    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      this.closePanel();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, this.flatResults.length - 1);
      this.cdr.detectChanges();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      this.cdr.detectChanges();
      return;
    }

    if (event.key === 'Enter' && this.activeIndex >= 0) {
      event.preventDefault();
      const result = this.flatResults[this.activeIndex];
      if (result) this.navigate(result);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.closePanel();
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  private runSearch(q: string): void {
    const results = this.search.search(q);
    this.flatResults = results;
    this.groups = this.groupResults(results);
    this.activeIndex = results.length > 0 ? 0 : -1;
    this.cdr.detectChanges();
  }

  private groupResults(results: SearchResult[]): ResultGroup[] {
    const order: SearchResultType[] = [
      'workflow', 'file', 'folder', 'project',
      'insight', 'documentation', 'repository-section',
    ];
    const labelMap: Record<SearchResultType, string> = {
      workflow:             'Workflows',
      file:                 'Files',
      folder:               'Folders',
      project:              'Projects',
      insight:              'Insights',
      documentation:        'Documentation',
      'repository-section': 'Key Sections',
    };
    const iconMap: Record<SearchResultType, string> = {
      workflow:             'workflow',
      file:                 'file',
      folder:               'folder',
      project:              'project',
      insight:              'insight',
      documentation:        'doc',
      'repository-section': 'section',
    };

    const buckets = new Map<SearchResultType, SearchResult[]>();
    for (const r of results) {
      if (!buckets.has(r.type)) buckets.set(r.type, []);
      buckets.get(r.type)!.push(r);
    }

    return order
      .filter(t => (buckets.get(t)?.length ?? 0) > 0)
      .map(t => ({
        label:   labelMap[t],
        icon:    iconMap[t],
        results: (buckets.get(t) ?? []).slice(0, 6),
      }));
  }

  get totalCount(): number {
    return this.flatResults.length;
  }

  isActive(result: SearchResult): boolean {
    return this.flatResults[this.activeIndex]?.id === result.id;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  navigate(result: SearchResult): void {
    this.closePanel();
    const target = result.navigationTarget;

    if (target.route === '/repository-navigation') {
      // Resolve the dependency node from knowledge and select it in nav context
      const k = this.knowledge.knowledge;
      let node: DependencyNode | null = null;

      if (k?.dependencyGraph) {
        if (target.nodeId) {
          node = k.dependencyGraph.nodes.find(n => n.id === target.nodeId) ?? null;
        }
        if (!node && target.nodeName) {
          node = k.dependencyGraph.nodes.find(n =>
            n.name === target.nodeName ||
            n.path === target.nodePath ||
            n.path?.endsWith('/' + target.nodeName) ||
            n.path?.endsWith('\\' + target.nodeName)
          ) ?? null;
        }
      }

      if (node) {
        this.nav.selectNode(node, 'search');
      } else if (target.nodeName) {
        // Node not yet in graph — construct a placeholder so navigation still works
        const placeholder: DependencyNode = {
          id:   target.nodeId ?? target.nodeName,
          name: target.nodeName,
          path: target.nodePath ?? target.nodeName,
          type: result.type === 'workflow' ? 'module' : 'module',
        };
        this.nav.selectNode(placeholder, 'search');
      }

      this.router.navigate(['/repository-navigation']);
      return;
    }

    this.router.navigate([target.route]);
  }

  closePanel(): void {
    this.isOpen = false;
    this.groups = [];
    this.flatResults = [];
    this.activeIndex = -1;
  }

  clearQuery(): void {
    this.query = '';
    this.closePanel();
  }

  get hasNoResults(): boolean {
    return this.isOpen && this.query.trim().length >= 2 && this.groups.length === 0;
  }

  get hasIndex(): boolean {
    return this.search.hasIndex;
  }
}
