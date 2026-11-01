import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { environment } from '@environments/environment';
import { AuthPayload, CodeLookup, LoginOutcome } from '../models/auth.models';
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

describe('AuthService · activar con cualquier código (D96)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reconoce la clave de una empresa y muestra su nombre', () => {
    let found: CodeLookup | undefined;
    service.lookupCode('MNK-AAAA-BBBB-CCCC').subscribe((f) => (found = f));
    http.expectOne(`${api}/redeem/lookup`).flush({ data: { company: { name: 'ACME' }, admin_email: 'admin@acme.co', expires_at: '2026-11-04T00:00:00Z' } });
    expect(found).toEqual({ kind: 'access_key', email: 'admin@acme.co', companyName: 'ACME', expiresAt: '2026-11-04T00:00:00Z' });
  });

  it('si no es una clave, prueba el código de activación de una persona del equipo', () => {
    let found: CodeLookup | undefined;
    service.lookupCode('MNK-7F3A-92KD-5QXB').subscribe((f) => (found = f));
    http.expectOne(`${api}/redeem/lookup`).flush({ message: 'x', error: { code: 'ACCESS_KEY_INVALID' } }, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${api}/activate/lookup`).flush({ data: { email: 'juan@acme.co', expires_at: '2026-11-04T00:00:00Z' } });
    expect(found).toEqual({ kind: 'activation', email: 'juan@acme.co', companyName: null, expiresAt: '2026-11-04T00:00:00Z' });
  });

  it('una clave vencida o ya usada se dice tal cual: no se prueba como código de activación', () => {
    let failed = false;
    service.lookupCode('MNK-AAAA-BBBB-CCCC').subscribe({ error: () => (failed = true) });
    http.expectOne(`${api}/redeem/lookup`).flush({ message: 'vencida', error: { code: 'ACCESS_KEY_EXPIRED' } }, { status: 409, statusText: 'Conflict' });
    http.expectNone(`${api}/activate/lookup`);
    expect(failed).toBeTrue();
  });

  it('crea la cuenta por la puerta que corresponde al código', () => {
    service.claimAccount({ kind: 'activation', email: 'juan@acme.co', companyName: null, expiresAt: '' }, 'MNK-7F3A-92KD-5QXB', 'UnaClaveLarga123!').subscribe();
    const activate = http.expectOne(`${api}/activate`);
    expect(activate.request.body).toEqual({ code: 'MNK-7F3A-92KD-5QXB', email: 'juan@acme.co', password: 'UnaClaveLarga123!' });
    activate.flush({ data: { next_step: 'mfa_setup', expires_at: '2026-10-28T14:05:00Z' } });
    expect(service.pendingMfa()?.next_step).toBe('mfa_setup');

    service.claimAccount({ kind: 'access_key', email: 'admin@acme.co', companyName: 'ACME', expiresAt: '' }, 'MNK-AAAA-BBBB-CCCC', 'UnaClaveLarga123!').subscribe();
    expect(http.expectOne(`${api}/redeem`).request.body.email).toBe('admin@acme.co');
  });
});

describe('AuthService · sin sesión no se consulta al servidor', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('mk_session');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem('mk_session');
  });

  it('sin marca de sesión validate responde false sin ninguna petición (no hay 401 en consola)', () => {
    let result: boolean | undefined;
    service.validate().subscribe((ok) => (result = ok));
    http.expectNone(`${api}/me`);
    expect(result).toBe(false);
  });

  it('con la marca sí pregunta al servidor, y si ya no hay sesión la borra', () => {
    localStorage.setItem('mk_session', '1');
    let result: boolean | undefined;
    service.validate().subscribe((ok) => (result = ok));
    http.expectOne(`${api}/me`).flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/refresh`).flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBe(false);
    expect(localStorage.getItem('mk_session')).toBeNull();
  });
});

describe('AuthService · olvidé mi contraseña (SEG-14, D101)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('asks for the recovery link with just the email', () => {
    let done = false;
    service.forgotPassword('ana@acme.co').subscribe(() => (done = true));
    const req = http.expectOne(`${environment.apiUrl}/auth/password/forgot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@acme.co' });
    req.flush({ data: null }, { status: 202, statusText: 'Accepted' });
    expect(done).toBe(true);
  });

  it('resets the password with the link token and the second factor, without opening a session', () => {
    const session = TestBed.inject(SessionService);
    service.resetPassword({ token: 'tok', new_password: 'Nueva-Clave-2026!', code: '123456' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/password/reset`);
    expect(req.request.body).toEqual({ token: 'tok', new_password: 'Nueva-Clave-2026!', code: '123456' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(session.isAuthenticated()).toBe(false);
  });
});
