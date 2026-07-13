import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { createHighlighter, type Highlighter } from 'shiki';
import { ThemeService } from './theme.service';

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'csharp',
  'html',
  'css',
  'scss',
  'less',
  'sql',
  'python',
  'json',
  'xml',
  'markdown',
  'yaml',
  'shellscript',
  'plaintext',
] as const;

const DARK_THEME = 'github-dark-dimmed';
const LIGHT_THEME = 'github-light';

@Injectable({ providedIn: 'root' })
export class SyntaxHighlightService {
  /** Emits whenever the active theme changes — subscribers should re-highlight. */
  readonly themeChange$: Observable<boolean>;

  private highlighter: Highlighter | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly themeService: ThemeService) {
    this.themeChange$ = themeService.isDark$;
  }

  private init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = createHighlighter({
      themes: [DARK_THEME, LIGHT_THEME],
      langs: [...SUPPORTED_LANGUAGES],
    }).then((h) => {
      this.highlighter = h;
    });

    return this.initPromise;
  }

  async highlight(code: string, language: string): Promise<string> {
    await this.init();
    if (!this.highlighter) return this.fallback(code);

    const lang = SUPPORTED_LANGUAGES.includes(language as any) ? language : 'plaintext';
    const theme = this.themeService.isDark ? DARK_THEME : LIGHT_THEME;

    try {
      return this.highlighter.codeToHtml(code, { lang, theme });
    } catch {
      return this.fallback(code);
    }
  }

  private fallback(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre class="shiki-fallback"><code>${escaped}</code></pre>`;
  }
}
