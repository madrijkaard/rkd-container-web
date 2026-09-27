import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthState } from './auth.service';
import { ContainerApi } from './container-api';

type Theme = 'light' | 'dark';
const THEME_KEY = 'container-web-theme';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ContainerApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthState);
  protected readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  protected toggleTheme(): void {
    const next: Theme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    this.applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // The selected theme still applies when browser storage is unavailable.
    }
  }

  protected logout(): void {
    this.api.logout().subscribe({
      next: () => {
        this.auth.username.set(null);
        void this.router.navigateByUrl('/login');
      },
    });
  }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Fall back to the system preference when browser storage is unavailable.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: Theme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }
}
