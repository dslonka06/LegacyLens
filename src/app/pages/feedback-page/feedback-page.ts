import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feedback-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-page.html',
  styleUrl: './feedback-page.scss'
})
export class FeedbackPage {

  generalFeedback = '';
  bugReport = '';
  featureRequest = '';
  submitted = false;

  submit(): void {
    const record = {
      general: this.generalFeedback,
      bug: this.bugReport,
      feature: this.featureRequest,
      submittedAt: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem('legacylens-feedback') ?? '[]');
    existing.push(record);
    localStorage.setItem('legacylens-feedback', JSON.stringify(existing));
    this.submitted = true;
    this.generalFeedback = '';
    this.bugReport = '';
    this.featureRequest = '';
  }

  reset(): void {
    this.submitted = false;
  }
}
