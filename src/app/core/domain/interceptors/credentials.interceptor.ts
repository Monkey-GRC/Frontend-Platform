import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { storedLanguage } from '@core/domain/services/language.service';
import { SessionService } from '@core/domain/services/session.service';
import { sanitizeHttpError } from '@core/domain/utils/sanitize-http-error';
import { AuthService } from '@core/domain/services/auth.service';

// Endpoints de auth: su 401 lo maneja AuthService (credenciales malas, sesión vencida), no aquí.
const AUTH_ENDPOINT = /\/auth\/(login|redeem|refresh|logout|me|mfa\/(verify|setup|setup\/confirm|recovery-codes))$/;

// Un 401 con código de dominio (segundo factor, credenciales, enlace) NO es una sesión caída: reintentarlo gastaría otro
// intento y repetiría bcrypt. Solo se renueva ante un 401 sin código o con el de sesión.
const SESSION_401_CODES = ['UNAUTHENTICATED', 'SESSION_EXPIRED'];

function isSessionExpired(error: HttpErrorResponse): boolean {
  const code = error.error?.error?.code;
  return typeof code !== 'string' || SESSION_401_CODES.includes(code);
}

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionService);
  const authService = inject(AuthService);
  const translate = inject(TranslateService);

  // Auth por cookie httpOnly: el navegador la adjunta, el código nunca toca los tokens.
  // `Accept-Language` lleva el idioma elegido para que el backend responda en ese idioma.
  // `X-Monkey-Client` elige qué juego de cookies usa el servidor para que Admin y Platform convivan en un mismo
  // navegador; no autentica nada.
  const authReq = req.clone({
    withCredentials: true,
    setHeaders: { 'Accept-Language': storedLanguage(), 'X-Monkey-Client': 'platform' },
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || AUTH_ENDPOINT.test(req.url) || !isSessionExpired(error)) {
        return throwError(() => sanitizeHttpError(error, translate.instant('COMMON.AUTH_PROBLEM')));
      }

      // El access token dura 15 min: ante un 401 se intenta renovar y se reintenta UNA vez, pase lo que pase con la
      // renovación: si falló, otra pestaña pudo rotar el refresh token y el navegador ya tiene cookies nuevas. Solo si
      // el reintento también responde 401 la sesión se da por perdida (30 min sin actividad u 8 h): se limpia y se
      // vuelve al inicio de sesión. Cualquier otro error del reintento se propaga tal cual.
      return authService.refresh().pipe(
        switchMap(() => next(authReq)),
        catchError((retryError: HttpErrorResponse) => {
          if (retryError.status === 401) {
            session.clear();
            router.navigate(['/signin']);
          }
          return throwError(() => sanitizeHttpError(retryError, translate.instant('COMMON.AUTH_PROBLEM')));
        }),
      );
    }),
  );
};
