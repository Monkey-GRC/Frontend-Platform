import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { SecurityService } from './security.service';

const api = environment.apiUrl;

describe('SecurityService (SEG-14, D101)', () => {
  let service: SecurityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SecurityService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('changes the password with the current one and the app code', () => {
    let done = false;
    service.changePassword({ current_password: 'Actual-1234567!', new_password: 'Nueva-1234567!', code: '123456' }).subscribe(() => (done = true));
    const req = http.expectOne(`${api}/auth/password/change`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ current_password: 'Actual-1234567!', new_password: 'Nueva-1234567!', code: '123456' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('accepts a recovery code instead of the app code', () => {
    service.changePassword({ current_password: 'a', new_password: 'b', recovery_code: 'K7QWM-3PZ9T' }).subscribe();
    const req = http.expectOne(`${api}/auth/password/change`);
    expect(req.request.body.recovery_code).toBe('K7QWM-3PZ9T');
    expect(req.request.body.code).toBeUndefined();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('regenerates the recovery codes and returns the new ten', () => {
    let codes: string[] = [];
    service.regenerateRecoveryCodes('123456').subscribe((c) => (codes = c));
    const req = http.expectOne(`${api}/auth/mfa/recovery-codes`);
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ data: { recovery_codes: ['AAAAA-BBBBB', 'CCCCC-DDDDD'] } });
    expect(codes).toEqual(['AAAAA-BBBBB', 'CCCCC-DDDDD']);
  });

  it('asks for the recovery link for the given email', () => {
    let done = false;
    service.requestPasswordRecovery('ana@acme.co').subscribe(() => (done = true));
    const req = http.expectOne(`${api}/auth/password/forgot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@acme.co' });
    req.flush({ data: null }, { status: 202, statusText: 'Accepted' });
    expect(done).toBe(true);
  });

  it('lists, forgets one and forgets all the remembered devices (D123)', () => {
    let count = -1;
    service.listDevices().subscribe((d) => (count = d.length));
    const list = http.expectOne(`${api}/auth/devices`);
    expect(list.request.method).toBe('GET');
    list.flush({ status: 200, message: 'ok', data: [{ id: 'd1' }] });
    expect(count).toBe(1);

    service.forgetDevice('d1').subscribe();
    const one = http.expectOne(`${api}/auth/devices/d1`);
    expect(one.request.method).toBe('DELETE');
    one.flush(null, { status: 204, statusText: 'No Content' });

    service.forgetAllDevices().subscribe();
    const all = http.expectOne(`${api}/auth/devices`);
    expect(all.request.method).toBe('DELETE');
    all.flush(null, { status: 204, statusText: 'No Content' });
  });
});
