import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-resize-divider',
  standalone: true,
  template: `<div class="resize-handle-inner"></div>`,
  styleUrl: './resize-divider.component.scss',
  host: { class: 'resize-divider' },
})
export class ResizeDividerComponent implements OnDestroy {
  /** Minimum pixel width to enforce on the panel to the LEFT of this divider. */
  @Input() minLeft = 160;
  /** Minimum pixel width to enforce on the panel to the RIGHT of this divider. */
  @Input() minRight = 160;

  /** Fired during a drag with the new width that the LEFT panel should adopt. */
  @Output() leftWidthChange = new EventEmitter<number>();

  private dragging = false;
  private startX = 0;
  private startWidth = 0;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.dragging = true;
    this.startX = e.clientX;

    // Read the current rendered width of the left sibling
    const prev = this.el.nativeElement.previousElementSibling as HTMLElement | null;
    this.startWidth = prev ? prev.getBoundingClientRect().width : 0;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const delta = e.clientX - this.startX;
    const newWidth = Math.max(this.minLeft, this.startWidth + delta);

    // Also enforce minRight against the parent's total width
    const parent = this.el.nativeElement.parentElement;
    if (parent) {
      const parentWidth = parent.getBoundingClientRect().width;
      const dividerWidth = this.el.nativeElement.getBoundingClientRect().width;
      const maxLeft = parentWidth - dividerWidth - this.minRight;
      this.leftWidthChange.emit(Math.min(newWidth, maxLeft));
    } else {
      this.leftWidthChange.emit(newWidth);
    }
  };

  private readonly onMouseUp = (): void => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
