import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantCredentialsService } from '@core/domain/services/tenant-credentials.service';

export const tenantCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantCredentials = inject(TenantCredentialsService);
  const credentials = tenantCredentials.get();

  if (!credentials) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      'mnk-client-identifier': credentials.identifier,
      'mnk-client-key': credentials.key,
    },
  });

  return next(authReq);
};
