import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { environment } from '@environments/environment';
import { AuthPayload, LoginOutcome } from '../models/auth.models';
import { AuthService } from './auth.service';

const payload: AuthPayload = {
  user: { id: 'u1', email: 'ana@empresa.com', name: null, last_name: null, role: 'admin_empresa', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-10-26T00:00:00Z' },
  company: { id: 'c1', name: 'Empresa' },
  onboarding: { next_step: null, completed_steps: [] },
};
const api = `${environment.apiUrl}/auth`;

describe('AuthService · segundo factor (D94)', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });
  afterEach(() => http.verify());

  it('un login con el factor obligatorio no abre sesión: deja el paso pendiente', () => {
    let outcome: LoginOutcome | undefined;
    service.login({ email: 'ana@empresa.com', password: 'x' }).subscribe((o) => (outcome = o));
    http.expectOne(`${api}/login`).flush({ status: 200, message: 'ok', data: { next_step: 'mfa_verify', expires_at: '2026-10-26T14:05:00Z' } });

    expect(outcome?.kind).toBe('mfa');
    expect(service.pendingMfa()?.next_step).toBe('mfa_verify');
    expect(session.user()).toBeNull();
  });

  it('un login sin segundo factor abre la sesión como siempre', () => {
    let outcome: LoginOutcome | undefined;
    service.login({ email: 'ana@empresa.com', password: 'x' }).subscribe((o) => (outcome = o));
    http.expectOne(`${api}/login`).flush({ status: 200, message: 'ok', data: payload });

    expect(outcome?.kind).toBe('session');
    expect(service.pendingMfa()).toBeNull();
    expect(session.user()?.email).toBe('ana@empresa.com');
  });

  it('verificar el código abre la sesión y limpia el paso pendiente', () => {
    service.pendingMfa.set({ next_step: 'mfa_verify', expires_at: '2026-10-26T14:05:00Z' });
    service.verifyMfa({ code: '123456' }).subscribe();
    const req = http.expectOne(`${api}/mfa/verify`);
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ status: 200, message: 'ok', data: payload });

    expect(service.pendingMfa()).toBeNull();
    expect(session.user()?.email).toBe('ana@empresa.com');
  });

  it('al confirmar la configuración la sesión NO se guarda hasta terminar (antes se ven los códigos de recuperación)', () => {
    service.pendingMfa.set({ next_step: 'mfa_setup', expires_at: '2026-10-26T14:05:00Z' });
    let received: string[] | undefined;
    service.confirmMfaSetup('123456').subscribe((p) => (received = p.recovery_codes));
    http.expectOne(`${api}/mfa/setup/confirm`).flush({ status: 200, message: 'ok', data: { ...payload, recovery_codes: ['AAAAA-BBBBB'] } });

    expect(received).toEqual(['AAAAA-BBBBB']);
    expect(session.user()).toBeNull();

    service.finishMfaSetup(payload).subscribe();
    expect(session.user()?.email).toBe('ana@empresa.com');
    expect(service.pendingMfa()).toBeNull();
  });
});
