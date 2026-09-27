import { inject, Injectable, signal } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ContainerApi } from './container-api';

@Injectable({ providedIn: 'root' })
export class AuthState {
  readonly username = signal<string | null>(null);
}

export const operatorGuard: CanActivateChildFn = (_route, state) => {
  const api = inject(ContainerApi);
  const auth = inject(AuthState);
  const router = inject(Router);
  const loginUrl = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return api.getSession().pipe(
    map((session) => {
      auth.username.set(session.authenticated ? session.username : null);
      return session.authenticated ? true : loginUrl();
    }),
    catchError(() => {
      auth.username.set(null);
      return of(loginUrl());
    }),
  );
};
