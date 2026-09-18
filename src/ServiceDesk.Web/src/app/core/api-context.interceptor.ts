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
  return next(request);
};
