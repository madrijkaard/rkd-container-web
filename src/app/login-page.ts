import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthState } from './auth.service';
import { ContainerApi } from './container-api';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

let turnstileScript: Promise<void> | undefined;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScript) {
    turnstileScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Turnstile indisponível'));
      document.head.appendChild(script);
    });
  }
  return turnstileScript;
}

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">ACESSO</p>
        <h1>Entrar</h1>
        <p class="muted">Use uma conta de operador do Dockestra Core.</p>
      </div>
    </div>
    <form class="panel record-form" (ngSubmit)="submit()">
      <div class="form-field">
        <label for="username">Usuário</label>
        <input id="username" name="username" #usernameInput [ngModel]="username"
               (ngModelChange)="onUsernameChange($event, usernameInput)"
               autocomplete="username" autocapitalize="characters" pattern="[A-Z0-9_]+" required />
      </div>
      <div class="form-field">
        <label for="password">Senha</label>
        <input id="password" name="password" type="password" [(ngModel)]="password"
               autocomplete="current-password" required />
      </div>
      <div #turnstileContainer [hidden]="!turnstileRequired()"></div>
      @if (error()) { <p class="status error" role="alert">{{ error() }}</p> }
      <div class="form-actions">
        <button class="button primary" type="submit"
                [disabled]="loading() || !username || !password || (turnstileRequired() && !turnstileToken())">
          {{ loading() ? 'Entrando...' : 'Entrar' }}
        </button>
      </div>
    </form>
  `,
})
export class LoginPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(ContainerApi);
  private readonly auth = inject(AuthState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild('turnstileContainer') private turnstileContainer?: ElementRef<HTMLDivElement>;
  private viewReady = false;
  private destroyed = false;
  private rendering = false;
  private widgetId?: string;
  private siteKey = '';

  protected username = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly turnstileRequired = signal(false);
  protected readonly turnstileToken = signal('');

  protected onUsernameChange(value: string, input: HTMLInputElement): void {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    input.value = normalized;
    this.username = normalized;
  }

  ngOnInit(): void {
    this.api.getSession().subscribe({
      next: (session) => {
        if (session.authenticated) {
          this.auth.username.set(session.username);
          void this.router.navigateByUrl(this.returnUrl());
        } else {
          this.turnstileRequired.set(session.turnstileRequired);
          this.siteKey = session.turnstileSiteKey;
          if (session.turnstileRequired && !this.siteKey) {
            this.error.set('A proteção do login não está configurada no servidor.');
          } else {
            void this.renderTurnstile();
          }
        }
      },
      error: () => this.error.set('Não foi possível conectar ao Dockestra Core.'),
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    void this.renderTurnstile();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) window.turnstile?.remove(this.widgetId);
  }

  private async renderTurnstile(): Promise<void> {
    if (!this.viewReady || !this.siteKey || this.widgetId || this.rendering || this.destroyed) return;
    this.rendering = true;
    try {
      await loadTurnstile();
      if (this.destroyed || !this.turnstileContainer || !window.turnstile) return;
      this.widgetId = window.turnstile.render(this.turnstileContainer.nativeElement, {
        sitekey: this.siteKey,
        action: 'login',
        theme: 'auto',
        callback: (token: string) => this.turnstileToken.set(token),
        'expired-callback': () => this.turnstileToken.set(''),
        'error-callback': () => {
          this.turnstileToken.set('');
          this.error.set('Não foi possível carregar a verificação de segurança. Recarregue a página.');
        },
      });
    } catch {
      this.error.set('Não foi possível carregar a verificação de segurança. Recarregue a página.');
    } finally {
      this.rendering = false;
    }
  }

  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') || '/projects';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/projects';
  }

  protected submit(): void {
    if (this.loading() || !this.username || !this.password ||
        (this.turnstileRequired() && !this.turnstileToken())) return;
    this.loading.set(true);
    this.error.set('');
    this.api.login(this.username, this.password, this.turnstileToken()).subscribe({
      next: (session) => {
        this.password = '';
        this.auth.username.set(session.username);
        void this.router.navigateByUrl(this.returnUrl());
      },
      error: (response) => {
        this.password = '';
        this.turnstileToken.set('');
        if (this.widgetId) window.turnstile?.reset(this.widgetId);
        this.error.set(response.error?.error || 'Não foi possível entrar. Confira usuário e senha.');
        this.loading.set(false);
      },
    });
  }
}
