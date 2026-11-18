import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SecurityView } from './security';

describe('SecurityView (resumen de Seguridad)', () => {
  let fixture: ComponentFixture<SecurityView>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SecurityView], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(SecurityView);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.apiUrl}/auth/devices`).flush({ status: 200, message: 'ok', data: [{ id: 'a' }, { id: 'b' }] });
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('groups the options into categories, each with a title', () => {
    expect(el().querySelectorAll('app-settings-group').length).toBe(3);
    expect(el().querySelectorAll('h2').length).toBe(3);
  });

  it('opens the password and the recovery codes in their own screens', () => {
    const hrefs = Array.from(el().querySelectorAll('a[data-testid="settings-row-link"]')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/ajustes/seguridad/contrasena', '/ajustes/seguridad/codigos-de-recuperacion', '/ajustes/seguridad/dispositivos']);
  });

  it('shows how many remembered devices are active', () => {
    expect(el().querySelector('[data-testid="devices-count"]')?.textContent).toContain('DEVICES_COUNT');
  });

  it('shows the authenticator app as required, as information (no link)', () => {
    expect(el().querySelector('[data-testid="mfa-required"]')).not.toBeNull();
    expect(el().querySelectorAll('[data-testid="settings-row-static"]').length).toBe(1);
  });
});
