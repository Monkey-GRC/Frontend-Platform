import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SecurityView } from './security';

describe('SecurityView (resumen de Seguridad)', () => {
  let fixture: ComponentFixture<SecurityView>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SecurityView], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(SecurityView);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('groups the options into categories, each with a title', () => {
    expect(el().querySelectorAll('app-settings-group').length).toBe(2);
    expect(el().querySelectorAll('h2').length).toBe(2);
  });

  it('opens the password and the recovery codes in their own screens', () => {
    const hrefs = Array.from(el().querySelectorAll('a[data-testid="settings-row-link"]')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/ajustes/seguridad/contrasena', '/ajustes/seguridad/codigos-de-recuperacion']);
  });

  it('shows the authenticator app as required, as information (no link)', () => {
    expect(el().querySelector('[data-testid="mfa-required"]')).not.toBeNull();
    expect(el().querySelectorAll('[data-testid="settings-row-static"]').length).toBe(1);
  });
});
