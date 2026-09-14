import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Attaches authentication context to every /api/* request.
 *
 * Auth0 mode: the @auth0/auth0-angular SDK injects the Bearer token automatically
 *             via its own interceptor (configured in app.config.ts httpInterceptor).
 *             This interceptor therefore does nothing extra in Auth0 mode.
 *
 * Dev mode:   sets X-Dev-User-Id header so the DevelopmentAuthenticationHandler
 *             can resolve the user from the in-memory membership table.
 */
export const apiContextInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  if (!request.url.startsWith('/api')) {
    return next(request);
  }

  // When the user is in dev mode (no Auth0 token), attach the dev header.
  const userId = auth.userId();
  if (!userId || auth.isAuth0Mode) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: { 'X-Dev-User-Id': userId },
  }));
};
