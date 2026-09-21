import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Attaches the native ServiceDesk JWT Bearer token to outgoing /api/* requests.
 */
export const apiContextInterceptor: HttpInterceptorFn = (request, next) => {
  // If requesting platform admin endpoints, use dev platform admin header if available
  if (request.url.includes('/api/v1/admin')) {
    const devAdminId = sessionStorage.getItem('servicedesk.devPlatformAdminId') ?? '99999999-9999-9999-9999-999999999999';
    request = request.clone({
      setHeaders: {
        'X-Dev-Platform-Admin-Id': devAdminId,
      },
    });
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
  return next(request);
};
