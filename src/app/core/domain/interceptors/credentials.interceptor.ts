import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { storedLanguage } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { sanitizeHttpError } from '@core/domain/utils/sanitize-http-error';
import { AuthService } from '@features/auth/domain/services/auth.service';

// Endpoints de auth: su 401 lo maneja AuthService (credenciales malas, sesión vencida), no aquí.
const AUTH_ENDPOINT = /\/auth\/(login|redeem|refresh|logout|me)$/;

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionService);
  const authService = inject(AuthService);
  const translate = inject(TranslateService);

  // Auth por cookie httpOnly: el navegador la adjunta, el código nunca toca los tokens.
  // `Accept-Language` lleva el idioma elegido para que el backend responda en ese idioma.
  const authReq = req.clone({ withCredentials: true, setHeaders: { 'Accept-Language': storedLanguage() } });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || AUTH_ENDPOINT.test(req.url)) {
        return throwError(() => sanitizeHttpError(error, translate.instant('COMMON.AUTH_PROBLEM')));
      }

      // El access token dura 15 min: ante un 401 se renueva una vez y se reintenta. Si la sesión
      // ya no se puede renovar (30 min sin actividad u 8 h), se vuelve al inicio de sesión.
      return authService.refresh().pipe(
        switchMap((ok) => {
          if (ok) return next(authReq);
          session.clear();
          router.navigate(['/signin']);
          return throwError(() => sanitizeHttpError(error, translate.instant('COMMON.AUTH_PROBLEM')));
        }),
      );
    }),
  );
};
