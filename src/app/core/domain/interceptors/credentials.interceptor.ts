import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { sanitizeHttpError } from '@core/domain/utils/sanitize-http-error';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const sessionService = inject(SessionService);

  const authReq = req.clone({ withCredentials: true });

  const isPublicRequest =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/validate') ||
    req.url.includes('/onboarding/master-templates') ||
    req.url.includes('/onboarding/complete');

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicRequest) {
        sessionService.clear();
        router.navigate(['/signin']);
      }
      return throwError(() => sanitizeHttpError(error));
    })
  );
};
