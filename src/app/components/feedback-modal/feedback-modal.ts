import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-modal.html',
  styleUrl: './feedback-modal.scss'
})
export class FeedbackModal {
  @Output() close = new EventEmitter<void>();

  rating: string | null = null;
  comment = '';
  submitted = false;

  readonly ratings = ['Great', 'Good', 'Okay', 'Poor'];

  selectRating(r: string): void {
    this.rating = r;
  }

  submit(): void {
    this.submitted = true;
    setTimeout(() => this.close.emit(), 1800);
  }

  dismiss(): void {
    this.close.emit();
  }
}
