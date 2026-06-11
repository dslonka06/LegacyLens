import { Injectable } from '@angular/core';

const PREFIX = 'll-layout:';

@Injectable({ providedIn: 'root' })
export class PanelLayoutService {

  /** Returns persisted widths for a panel group, or null if none saved. */
  load(groupId: string): number[] | null {
    try {
      const raw = localStorage.getItem(PREFIX + groupId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(v => typeof v === 'number')) {
        return parsed;
      }
    } catch {
      // Corrupt entry — fall through to null
    }
    return null;
  }

  /** Persists widths for a panel group. */
  save(groupId: string, widths: number[]): void {
    try {
      localStorage.setItem(PREFIX + groupId, JSON.stringify(widths));
    } catch {
      // localStorage unavailable (private browsing, quota) — degrade silently
    }
  }

  /** Removes saved widths for a panel group. */
  reset(groupId: string): void {
    try {
      localStorage.removeItem(PREFIX + groupId);
    } catch { /* ignore */ }
  }
}
