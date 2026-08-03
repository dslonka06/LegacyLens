import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ThemeService } from '@app/core/services/theme.service';

@Component({
  selector: 'app-mermaid-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mermaid-diagram.html',
  styleUrl: './mermaid-diagram.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidDiagram implements OnChanges, AfterViewInit {
  @Input() diagram: string | null | undefined = null;
  @Input() maxWidth: string = '90%';

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  svgHtml: SafeHtml | null = null;
  renderError = false;
  private viewReady = false;

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly theme: ThemeService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.diagram) this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagram'] && this.viewReady) {
      this.render();
    }
  }

  private async render(): Promise<void> {
    const text = this.diagram?.trim();
    if (!text) {
      this.svgHtml = null;
      this.renderError = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const mermaid = (await import('mermaid')).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: this.theme.isDark ? 'dark' : 'default',
        fontFamily: 'inherit',
        flowchart: { curve: 'basis', useMaxWidth: true },
      });

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, text);

      this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(this._normaliseSvg(svg));
      this.renderError = false;
    } catch (err) {
      this.svgHtml = null;
      // Don't show error state if mermaid package isn't installed yet
      const msg = err instanceof Error ? err.message : String(err);
      this.renderError = !msg.includes('Cannot find module') && !msg.includes('Failed to fetch');
    }

    this.cdr.markForCheck();
  }

  /**
   * Post-process Mermaid's SVG output so it scales responsively.
   * Mermaid sets explicit width/height px attributes; we preserve them as
   * viewBox then replace with 100%/auto so CSS can control the size.
   */
  private _normaliseSvg(svg: string): string {
    // Extract existing width/height attributes to build a viewBox if absent
    const wMatch = svg.match(/\bwidth="([^"]+)"/);
    const hMatch = svg.match(/\bheight="([^"]+)"/);
    const w = wMatch?.[1];
    const h = hMatch?.[1];

    // If there's already a viewBox, just remove the fixed dimensions
    const hasViewBox = /viewBox=/.test(svg);

    let out = svg;

    if (!hasViewBox && w && h) {
      // Insert viewBox using the pixel dimensions
      const wPx = parseFloat(w);
      const hPx = parseFloat(h);
      if (!isNaN(wPx) && !isNaN(hPx)) {
        out = out.replace(/<svg /, `<svg viewBox="0 0 ${wPx} ${hPx}" `);
      }
    }

    // Replace fixed width/height with responsive values
    out = out
      .replace(/\bwidth="[^"]*"/, 'width="100%"')
      .replace(/\bheight="[^"]*"/, 'height="auto"');

    // Inject inline style so it always wins over Mermaid's own style block
    out = out.replace(/<svg /, `<svg style="max-width:${this.maxWidth};height:auto;display:block;" `);

    return out;
  }
}
