import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const auth0 = inject(Auth0Service, { optional: true });
  if (auth0) {
    return auth0.isAuthenticated$.pipe(
      take(1),
      map(isAuth => (isAuth ? true : router.createUrlTree(['/login'])))
    );
  }

  return router.createUrlTree(['/login']);
};
