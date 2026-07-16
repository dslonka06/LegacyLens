import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '@app/core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggle {
  constructor(readonly theme: ThemeService) {}
}
