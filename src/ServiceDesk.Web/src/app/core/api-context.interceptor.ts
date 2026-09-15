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

  // ── Platform Admin endpoints (/api/v1/admin/*) ────────────────────────────
  if (request.url.startsWith('/api/v1/admin')) {
    // Only attach dev platform header in non-Auth0 dev mode when configured
    if (!auth.isAuth0Mode) {
      const devAdminId = sessionStorage.getItem('servicedesk.devPlatformAdminId')
        ?? '99999999-9999-9999-9999-999999999999';

      return next(request.clone({
        setHeaders: { 'X-Dev-Platform-Admin-Id': devAdminId },
      }));
    }
    return next(request);
  }

  // ── Tenant endpoints (/api/v1/businesses/*, etc.) ────────────────────────
  const userId = auth.userId();
  if (!userId || auth.isAuth0Mode) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: { 'X-Dev-User-Id': userId },
  }));
};
