import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { Sidebar } from '@app/shell/sidebar/sidebar';
import { ThemeService } from '@app/core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isHome = false;

  constructor(
    readonly theme: ThemeService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.isHome = e.urlAfterRedirects === '/';
      });

    this.isHome = this.router.url === '/';
  }
}
