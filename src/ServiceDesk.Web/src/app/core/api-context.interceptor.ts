import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Attaches the native ServiceDesk JWT Bearer token to outgoing /api/* requests,
 * and handles 401 unauthorized session expiry.
 */
export const apiContextInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);

  // If requesting platform admin endpoints, use dev platform admin header if available
  if (request.url.includes('/api/v1/admin')) {
    const devAdminId = sessionStorage.getItem('servicedesk.devPlatformAdminId');
    if (devAdminId) {
      request = request.clone({
        setHeaders: {
          'X-Dev-Platform-Admin-Id': devAdminId,
        },
      });
    }
    return next(request);
  }

  const token = sessionStorage.getItem('sd.token');
  if (token && !request.headers.has('Authorization')) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !request.url.includes('/api/v1/auth/')) {
        sessionStorage.clear();
        void router.navigate(['/login'], { queryParams: { expired: '1' } });
      }
      return throwError(() => error);
    })
  );
};
