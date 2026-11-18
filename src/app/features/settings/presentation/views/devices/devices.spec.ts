import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { DevicesSettingsView } from './devices';

const api = `${environment.apiUrl}/auth/devices`;
const device = (over: object = {}) => ({
  id: 'd1', browser: 'Chrome', os: 'Windows', ip_address: '181.49.12.7', country: 'CO', city: 'Bogotá',
  created_at: '2026-11-18T15:04:00Z', expires_at: '2026-12-18T15:04:00Z', last_used_at: null, is_current: false, ...over,
});

describe('DevicesSettingsView (dispositivos recordados, D123)', () => {
  let fixture: ComponentFixture<DevicesSettingsView>;
  let http: HttpTestingController;
  let toast: ToastService;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector<HTMLElement>(`[data-testid="${id}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DevicesSettingsView],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' })],
    });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { SETTINGS: { SECURITY: { DEVICES: { GROUP_TITLE: '{{type}} · {{os}}', TYPE_COMPUTER: 'Computador', TYPE_MOBILE: 'Celular' } } } });
    translate.use('es');
    fixture = TestBed.createComponent(DevicesSettingsView);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const respond = (data: object[]) => {
    http.expectOne(api).flush({ status: 200, message: 'ok', data });
    fixture.detectChanges();
  };

  it('shows a loading state, then the list with the current device marked', () => {
    expect(q('devices-loading')).not.toBeNull();
    respond([device({ is_current: true }), device({ id: 'd2', browser: null, os: null, country: null, city: null })]);
    expect(el().querySelectorAll('[data-testid="device-row"]').length).toBe(2);
    expect(q('device-current')).not.toBeNull();
    expect(q('devices-forget-all')).not.toBeNull();
  });

  it('groups by type and system with the current group first, a count and the device icon', () => {
    respond([
      device({ id: 'a', os: 'Android', device_type: 'mobile', browser: 'Chrome' }),
      device({ id: 'b', os: 'Ubuntu', device_type: 'computer', browser: 'Firefox' }),
      device({ id: 'c', os: 'Ubuntu', device_type: 'computer', is_current: true }),
    ]);
    const groups = el().querySelectorAll('[data-testid="device-group"]');
    expect(groups.length).toBe(2);
    expect(groups[0].querySelector('h2')!.textContent).toBe('Computador · Ubuntu');
    expect(groups[1].querySelector('h2')!.textContent).toBe('Celular · Android');
    expect(groups[0].querySelectorAll('[data-testid="device-row"]').length).toBe(2);
    expect(groups[0].querySelector('app-device-icon')).not.toBeNull();
    expect(groups[0].querySelector('[data-testid="device-current"]')).not.toBeNull();
    expect(groups[1].querySelector('[data-testid="device-group-count"]')).not.toBeNull();
  });

  it('derives the type from the system when the backend does not send it', () => {
    respond([device({ id: 'a', os: 'Android' })]);
    expect(el().querySelector('[data-device-glyph]')!.textContent).toBe('smartphone');
  });

  it('shows the empty state', () => {
    respond([]);
    expect(q('devices-empty')).not.toBeNull();
    expect(q('devices-forget-all')).toBeNull();
  });

  it('shows the error with a retry', () => {
    http.expectOne(api).flush({}, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(q('devices-error')).not.toBeNull();
  });

  it('forgets one device only after confirming, then reloads and warns about the current one', () => {
    respond([device({ is_current: true })]);
    const success = spyOn(toast, 'showSuccess').and.callThrough();
    q('device-forget')!.click();
    fixture.detectChanges();
    http.expectNone(`${api}/d1`);
    el().querySelector<HTMLButtonElement>('app-confirm-dialog button.mk-btn-danger')!.click();
    http.expectOne(`${api}/d1`).flush(null, { status: 204, statusText: 'No Content' });
    expect(success).toHaveBeenCalled();
    expect(success.calls.mostRecent().args[1]).not.toBe('');
    respond([]);
    expect(q('devices-empty')).not.toBeNull();
  });

  it('forgets all after confirming', () => {
    respond([device(), device({ id: 'd2' })]);
    q('devices-forget-all')!.click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('app-confirm-dialog button.mk-btn-danger')!.click();
    const req = http.expectOne(api);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    respond([]);
  });

  it('puts the country name in the active language and falls back when there is no location', () => {
    respond([device(), device({ id: 'd2', country: null, city: null })]);
    const c = fixture.componentInstance;
    expect(c.location(device())).toContain('Bogotá, ');
    expect(c.location(device({ country: null, city: null }))).toBeTruthy();
  });
});
