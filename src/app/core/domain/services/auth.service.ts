import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '@environments/environment';
import { apiErrorCode } from '@core/domain/utils/api-error';
import { SessionService } from '@core/domain/services/session.service';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import {
  AccessKeyLookup,
  ActivationLookup,
  AuthPayload,
  AuthPayloadWithRecovery,
  CodeLookup,
  LoginDto,
  LoginOutcome,
  MfaSetupStart,
  MfaStep,
  RedeemDto,
} from '../models/auth.models';

// Monkey Platform es para las empresas cliente; el equipo Monkey trabaja en Monkey Admin (D24).
const PLATFORM_EXCLUDED_ROLE = 'admin_monkey';
// Clave de traducción (auth.json): el mensaje se traduce al momento de mostrarlo.
export const ADMIN_NOT_ALLOWED_MESSAGE = 'AUTH.ADMIN_NOT_ALLOWED';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly translate = inject(TranslateService);
  private readonly baseUrl = `${environment.apiUrl}/auth`;
  // Un solo refresh en vuelo aunque varias peticiones reciban 401 a la vez.
  private refreshInFlight$: Observable<boolean> | null = null;
  // El paso del segundo factor que dejó el login o el canje; la pantalla `/mfa` lo lee. Se pierde al recargar (entonces se vuelve a iniciar sesión).
  readonly pendingMfa = signal<MfaStep | null>(null);

  /** Login con correo y contraseña (todas las veces después del primer acceso). Con el segundo factor obligatorio no abre sesión: pide el código (D94). */
  login(dto: LoginDto): Observable<LoginOutcome> {
    return this.http
      .post<SuccessResponse<AuthPayload | MfaStep>>(`${this.baseUrl}/login`, dto)
      .pipe(unwrapData(), switchMap((data) => this.outcome(data)));
  }

  /** Paso 1 de la activación: con el código, la empresa y el correo que fijó Monkey (no gasta la clave). */
  lookupAccessKey(code: string): Observable<AccessKeyLookup> {
    return this.http
      .post<SuccessResponse<AccessKeyLookup>>(`${this.baseUrl}/redeem/lookup`, { code })
      .pipe(unwrapData());
  }

  /**
   * Paso 1 de la activación con CUALQUIER código: el de una empresa (clave de acceso) o el de una persona del equipo (D96). Se prueba primero como clave; si no es una
   * clave, como código de activación. Cualquier otro error (vencido, ya usado, demasiados intentos) se muestra tal cual.
   */
  lookupCode(code: string): Observable<CodeLookup> {
    return this.lookupAccessKey(code).pipe(
      map((found): CodeLookup => ({ kind: 'access_key', email: found.admin_email, companyName: found.company.name, expiresAt: found.expires_at })),
      catchError((error) => (apiErrorCode(error) === 'ACCESS_KEY_INVALID' ? this.lookupActivationCode(code) : throwError(() => error))),
    );
  }

  /** Paso 2: crea la cuenta con la contraseña, por la puerta que corresponde al código. Con el factor obligatorio, sigue la configuración del segundo factor. */
  claimAccount(found: CodeLookup, code: string, password: string): Observable<LoginOutcome> {
    if (found.kind === 'access_key') return this.redeem({ code, email: found.email, password });
    return this.http
      .post<SuccessResponse<AuthPayload | MfaStep>>(`${this.baseUrl}/activate`, { code, email: found.email, password })
      .pipe(unwrapData(), switchMap((data) => this.outcome(data)));
  }

  private lookupActivationCode(code: string): Observable<CodeLookup> {
    return this.http
      .post<SuccessResponse<ActivationLookup>>(`${this.baseUrl}/activate/lookup`, { code })
      .pipe(
        unwrapData(),
        map((found): CodeLookup => ({ kind: 'activation', email: found.email, companyName: null, expiresAt: found.expires_at })),
      );
  }

  /** Paso 2: canjea la clave de acceso y crea la cuenta del administrador de la empresa. Con el factor obligatorio, sigue la configuración del segundo factor. */
  redeem(dto: RedeemDto): Observable<LoginOutcome> {
    return this.http
      .post<SuccessResponse<AuthPayload | MfaStep>>(`${this.baseUrl}/redeem`, dto)
      .pipe(unwrapData(), switchMap((data) => this.outcome(data)));
  }

  /** Segundo paso del ingreso: el código de 6 dígitos de la app o uno de recuperación. Abre la sesión. */
  verifyMfa(input: { code: string } | { recovery_code: string }): Observable<AuthPayloadWithRecovery> {
    return this.http.post<SuccessResponse<AuthPayloadWithRecovery>>(`${this.baseUrl}/mfa/verify`, input).pipe(
      unwrapData(),
      switchMap((data) => this.acceptSession(data)),
      tap(() => this.pendingMfa.set(null)),
    );
  }

  /** Pide el secreto y la dirección del QR (el mismo mientras el desafío viva). */
  startMfaSetup(): Observable<MfaSetupStart> {
    return this.http.post<SuccessResponse<MfaSetupStart>>(`${this.baseUrl}/mfa/setup`, {}).pipe(unwrapData());
  }

  /**
   * Confirma el primer código y activa el factor. El servidor ya abrió la sesión, pero aquí NO se guarda todavía: antes la persona debe ver sus códigos
   * de recuperación (una sola vez); `finishMfaSetup` la deja entrar.
   */
  confirmMfaSetup(code: string): Observable<AuthPayloadWithRecovery> {
    return this.http.post<SuccessResponse<AuthPayloadWithRecovery>>(`${this.baseUrl}/mfa/setup/confirm`, { code }).pipe(unwrapData());
  }

  /** Entra a la plataforma una vez guardados los códigos. */
  finishMfaSetup(payload: AuthPayload): Observable<AuthPayload> {
    return this.acceptSession(payload).pipe(tap(() => this.pendingMfa.set(null)));
  }

  /** Genera 10 códigos de recuperación nuevos (los anteriores dejan de servir). Pide un código vigente de la app. */
  regenerateRecoveryCodes(code: string): Observable<string[]> {
    return this.http
      .post<SuccessResponse<{ recovery_codes: string[] }>>(`${this.baseUrl}/mfa/recovery-codes`, { code })
      .pipe(
        unwrapData(),
        map((data) => data.recovery_codes),
      );
  }

  /** «Olvidé mi contraseña»: pide el enlace al correo. Responde igual exista o no la cuenta, así que no hay nada que distinguir (D101). */
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/forgot`, { email }).pipe(map(() => void 0));
  }

  /** Crea la contraseña nueva con el token del enlace y el segundo factor. Cierra todas las sesiones: después hay que iniciar sesión (D101). */
  resetPassword(input: { token: string; new_password: string; code?: string; recovery_code?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/reset`, input).pipe(map(() => void 0));
  }

  /**
   * ¿Hay sesión? Consulta /auth/me; si el access token (15 min) venció, intenta renovarlo y vuelve a consultar,
   * sin mirar el resultado de la renovación: si falló, otra pestaña pudo haberla hecho y las cookies ya son válidas.
   * La sesión vive hasta 30 min sin actividad y 8 h en total: pasado eso, /me vuelve a fallar y se limpia.
   */
  validate(): Observable<boolean> {
    // Sin sesión abierta en este navegador no se pregunta al servidor (evita un 401 en cada visita al inicio de sesión).
    if (!this.session.isAuthenticated() && !this.session.hasSessionHint()) return of(false);
    return this.me().pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 401
          ? this.refresh().pipe(switchMap(() => this.me()))
          : of(false),
      ),
      catchError(() => of(false)),
      tap((ok) => {
        if (!ok) this.session.clear();
      }),
    );
  }

  /** Renueva la sesión (cookie → cookie). false si falló; no toca la sesión local: quien llama decide tras reintentar. */
  refresh(): Observable<boolean> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http.post(`${this.baseUrl}/refresh`, {}).pipe(
        map(() => true),
        catchError(() => of(false)),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );
    }
    return this.refreshInFlight$;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}).pipe(
      catchError(() => of(void 0)),
      tap(() => this.session.clear()),
    );
  }

  private me(): Observable<boolean> {
    return this.http.get<SuccessResponse<AuthPayload>>(`${this.baseUrl}/me`).pipe(
      map((res) => {
        const payload = res.data;
        if (!payload || payload.user.role === PLATFORM_EXCLUDED_ROLE) return false;
        this.session.set(payload.user, payload.company, payload.onboarding ?? null);
        return true;
      }),
    );
  }

  private outcome(data: AuthPayload | MfaStep): Observable<LoginOutcome> {
    if ('next_step' in data && 'expires_at' in data) {
      this.pendingMfa.set(data);
      return of({ kind: 'mfa', step: data });
    }
    return this.acceptSession(data).pipe(map((payload) => ({ kind: 'session' as const, payload })));
  }

  private acceptSession<T extends AuthPayload>(payload: T): Observable<T> {
    if (payload.user.role === PLATFORM_EXCLUDED_ROLE) {
      return this.logout().pipe(switchMap(() => throwError(() => new Error(this.translate.instant(ADMIN_NOT_ALLOWED_MESSAGE)))));
    }
    this.session.set(payload.user, payload.company, payload.onboarding ?? null);
    return of(payload);
  }
}
