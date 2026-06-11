import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AnalysisType, HistoryEntry } from '../../models/history-entry.model';
import { HistoryService } from '../../services/history.service';
import { FilterByTypePipe } from '../../pipes/filter-by-type.pipe';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FilterByTypePipe],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss'
})
export class HistoryPage implements OnInit {

  entries: HistoryEntry[] = [];
  activeFilter: AnalysisType | 'all' = 'all';

  constructor(
    private readonly history: HistoryService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.entries = this.history.getEntries();
  }

  get filtered(): HistoryEntry[] {
    if (this.activeFilter === 'all') return this.entries;
    return this.entries.filter(e => e.analysisType === this.activeFilter);
  }

  setFilter(filter: AnalysisType | 'all'): void {
    this.activeFilter = filter;
  }

  openEntry(entry: HistoryEntry): void {
    const routes: Record<AnalysisType, string> = {
      file: '/file-analysis',
      folder: '/folder-analysis',
      repository: '/repository-analysis',
    };
    this.router.navigate([routes[entry.analysisType]]);
  }

  deleteEntry(entry: HistoryEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.history.deleteEntry(entry.id);
    this.entries = this.history.getEntries();
  }

  clearHistory(): void {
    this.history.clearHistory();
    this.entries = [];
  }

  typeLabel(type: AnalysisType): string {
    return ({ file: 'File', folder: 'Folder', repository: 'Repository' })[type];
  }

  routeLabel(type: AnalysisType): string {
    return ({ file: 'File Analysis', folder: 'Folder Analysis', repository: 'Repository Analysis' })[type];
  }
}
