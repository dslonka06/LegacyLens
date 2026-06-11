import { Pipe, PipeTransform } from '@angular/core';
import { AnalysisType, HistoryEntry } from '../models/history-entry.model';

@Pipe({ name: 'filterByType', standalone: true, pure: true })
export class FilterByTypePipe implements PipeTransform {
  transform(entries: HistoryEntry[], type: AnalysisType): number {
    return entries.filter(e => e.analysisType === type).length;
  }
}
