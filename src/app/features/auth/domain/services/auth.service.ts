import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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
import { SessionService } from '@core/domain/services/session.service';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { AccessKeyLookup, AuthPayload, LoginDto, RedeemDto } from '../models/auth.models';

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

  /** Login con correo y contraseña (todas las veces después del primer acceso). */
  login(dto: LoginDto): Observable<AuthPayload> {
    return this.http
      .post<SuccessResponse<AuthPayload>>(`${this.baseUrl}/login`, dto)
      .pipe(switchMap((res) => this.acceptSession(res.data!)));
  }

  /** Paso 1 de la activación: con el código, la empresa y el correo que fijó Monkey (no gasta la clave). */
  lookupAccessKey(code: string): Observable<AccessKeyLookup> {
    return this.http
      .post<SuccessResponse<AccessKeyLookup>>(`${this.baseUrl}/redeem/lookup`, { code })
      .pipe(map((res) => res.data!));
  }

  /** Paso 2: canjea la clave de acceso y crea la cuenta del administrador de la empresa. */
  redeem(dto: RedeemDto): Observable<AuthPayload> {
    return this.http
      .post<SuccessResponse<AuthPayload>>(`${this.baseUrl}/redeem`, dto)
      .pipe(switchMap((res) => this.acceptSession(res.data!)));
  }

  /**
   * ¿Hay sesión? Consulta /auth/me; si el access token (15 min) venció, intenta renovarlo. La
   * sesión vive hasta 30 min sin actividad y 8 h en total: pasado eso, hay que volver a entrar.
   */
  validate(): Observable<boolean> {
    return this.me().pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 401
          ? this.refresh().pipe(switchMap((ok) => (ok ? this.me() : of(false))))
          : of(false),
      ),
      catchError(() => of(false)),
      tap((ok) => {
        if (!ok) this.session.clear();
      }),
    );
  }

  /** Renueva la sesión (cookie → cookie). false si ya no se puede renovar. */
  refresh(): Observable<boolean> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http.post(`${this.baseUrl}/refresh`, {}).pipe(
        map(() => true),
        catchError(() => {
          this.session.clear();
          return of(false);
        }),
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

  private acceptSession(payload: AuthPayload): Observable<AuthPayload> {
    if (payload.user.role === PLATFORM_EXCLUDED_ROLE) {
      return this.logout().pipe(switchMap(() => throwError(() => new Error(this.translate.instant(ADMIN_NOT_ALLOWED_MESSAGE)))));
    }
    this.session.set(payload.user, payload.company, payload.onboarding ?? null);
    return of(payload);
  }
}
