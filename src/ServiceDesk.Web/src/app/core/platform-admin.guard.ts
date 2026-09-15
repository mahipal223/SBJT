import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlatformContextService } from './platform-context.service';

export const platformAdminGuard: CanActivateFn = async (route, state) => {
  const platformContext = inject(PlatformContextService);
  const router = inject(Router);

  if (platformContext.operator()) {
    return true;
  }

  const op = await platformContext.loadCurrentOperator();
  if (op) {
    return true;
  }

  void router.navigate(['/platform-admin/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
