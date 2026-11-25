import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { envelope } from '@features/notifications/testing/notification-fixtures';
import { NotificationPreferencesView } from './notification-preferences';

const api = `${environment.apiUrl}/me/notification-preferences`;

describe('NotificationPreferencesView', () => {
  let fixture: ComponentFixture<NotificationPreferencesView>;
  let backend: HttpTestingController;
  let toast: ToastService;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const prefs = (enabled: boolean) => envelope({ is_email_digest_enabled: enabled, email_digest_time_utc: '12:00' }, 'notification.preferences');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationPreferencesView],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' })],
    });
    backend = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(NotificationPreferencesView);
    fixture.detectChanges();
  });
  afterEach(() => backend.verify());

  const load = (enabled = true) => {
    backend.expectOne(api).flush(prefs(enabled));
    fixture.detectChanges();
  };
  // `app-switch` (design system): the button inside carries the id, `role="switch"` and `aria-checked`.
  const switchEl = () => el().querySelector<HTMLButtonElement>('[data-testid="digest-switch"] button')!;
  const isOn = () => switchEl().getAttribute('aria-checked') === 'true';

  it('shows a skeleton while it loads, then the switch with the hour of the digest and the notice that the bell stays on', () => {
    expect(q('prefs-loading')).not.toBeNull();
    load();
    expect(q('prefs-loading')).toBeNull();
    expect(switchEl().getAttribute('role')).toBe('switch');
    expect(switchEl().id).toBe('digest-switch');
    expect(switchEl().getAttribute('aria-describedby')).toBe('digest-help');
    expect(isOn()).toBeTrue();
    expect(q('digest-time')!.textContent).toContain('NOTIFICATIONS.SETTINGS.DIGEST_TIME');
    expect(q('bell-always-on')).not.toBeNull();
    expect(el().querySelector('label[for="digest-switch"]')).not.toBeNull();
  });

  it('turns the digest off and tells the person', () => {
    load();
    const success = spyOn(toast, 'showSuccess');
    switchEl().click();
    fixture.detectChanges();
    const req = backend.expectOne(api);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ is_email_digest_enabled: false });
    expect(switchEl().getAttribute('aria-busy')).toBe('true');
    req.flush(prefs(false));
    fixture.detectChanges();
    expect(isOn()).toBeFalse();
    expect(switchEl().getAttribute('aria-busy')).toBeNull();
    expect(q('digest-state')!.textContent).toContain('NOTIFICATIONS.SETTINGS.OFF');
    expect(success).toHaveBeenCalled();
  });

  it('puts the switch back and shows the error when the server does not accept the change', () => {
    load();
    const error = spyOn(toast, 'showError');
    switchEl().click();
    fixture.detectChanges();
    backend.expectOne(api).flush({ message: 'No se pudo guardar' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(isOn()).toBeTrue();
    expect(error).toHaveBeenCalled();
  });

  it('shows an error with a retry when the preferences do not load', () => {
    backend.expectOne(api).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(q('prefs-error')).not.toBeNull();
    (q('prefs-error')!.querySelector('button') as HTMLButtonElement).click();
    load(false);
    expect(isOn()).toBeFalse();
  });
});
