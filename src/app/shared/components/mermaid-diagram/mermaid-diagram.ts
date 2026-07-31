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

      this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(svg);
      this.renderError = false;
    } catch (err) {
      this.svgHtml = null;
      // Don't show error state if mermaid package isn't installed yet
      const msg = err instanceof Error ? err.message : String(err);
      this.renderError = !msg.includes('Cannot find module') && !msg.includes('Failed to fetch');
    }

    this.cdr.markForCheck();
  }
}
