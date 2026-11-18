import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { credentialsInterceptor } from './credentials.interceptor';

const api = environment.apiUrl;

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([credentialsInterceptor])), provideHttpClientTesting(), provideRouter([]), provideTranslateService()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
    session.set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
  });
  afterEach(() => backend.verify());

  it('sends the cookies and the chosen language with every request', () => {
    http.get(`${api}/companies`).subscribe();
    const req = backend.expectOne(`${api}/companies`);
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Accept-Language')).toBeTrue();
    expect(req.request.headers.get('X-Monkey-Client')).toBe('platform');
    req.flush({});
  });

  it('on a 401 renews the session once and retries the request', () => {
    const navigateA = spyOn(router, 'navigate').and.resolveTo(true);
    let body: unknown;
    http.get(`${api}/companies`).subscribe((b) => (body = b));
    backend.expectOne(`${api}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/auth/refresh`).flush({});
    backend.expectOne(`${api}/companies`).flush({ ok: true });
    expect(body).toEqual({ ok: true });
    expect(navigateA).not.toHaveBeenCalled();
    expect(session.isAuthenticated()).toBeTrue();
  });

  it('when the renewal fails but the retry works (another tab renewed) it resolves without leaving', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    let body: unknown;
    http.get(`${api}/companies`).subscribe((b) => (body = b));
    backend.expectOne(`${api}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/companies`).flush({ ok: true });
    expect(body).toEqual({ ok: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(session.isAuthenticated()).toBeTrue();
  });

  it('when the retry is also a 401 it clears the session and goes to the sign-in, with no second retry', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    
    let failed = false;
    http.get(`${api}/companies`).subscribe({ error: () => (failed = true) });
    backend.expectOne(`${api}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeTrue();
    expect(session.isAuthenticated()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/signin']);
  });

  it('does not try to renew when the 401 comes from an auth endpoint', () => {
    let failed = false;
    http.post(`${api}/auth/login`, {}).subscribe({ error: () => (failed = true) });
    backend.expectOne(`${api}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeTrue();
  });

  it('does not renew nor retry a 401 with a second-factor domain code (single request)', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    let failed = false;
    http.post(`${api}/auth/password/change`, {}).subscribe({ error: () => (failed = true) });
    backend
      .expectOne(`${api}/auth/password/change`)
      .flush({ error: { code: 'MFA_CODE_INVALID' } }, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(`${api}/auth/refresh`);
    expect(failed).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
    expect(session.isAuthenticated()).toBeTrue();
  });

  it('renews and retries once on a 401 with the session code', () => {
    let body: unknown;
    http.get(`${api}/companies`).subscribe((b) => (body = b));
    backend.expectOne(`${api}/companies`).flush({ error: { code: 'SESSION_EXPIRED' } }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/auth/refresh`).flush({});
    backend.expectOne(`${api}/companies`).flush({ ok: true });
    expect(body).toEqual({ ok: true });
  });
});
