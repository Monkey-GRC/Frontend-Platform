import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { RegisterForm } from './register-form';

describe('RegisterForm · la contraseña del primer ingreso', () => {
  let fixture: ComponentFixture<RegisterForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RegisterForm],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['lookupCode', 'claimAccount']) }],
    });
    fixture = TestBed.createComponent(RegisterForm);
    fixture.componentInstance.lookup.set({ kind: 'access_key', email: 'ana@acme.co', companyName: 'ACME', expiresAt: '2026-12-01T00:00:00Z' });
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('shows the password guide when the person chooses a password', () => {
    expect(el().querySelector('[data-testid="password-guide"]')).not.toBeNull();
  });

  it('does NOT ask for «different from the current one»: a new account has no current password', () => {
    expect(el().querySelector('[data-check="different"]')).toBeNull();
    expect(el().querySelector('[data-check="match"]')).not.toBeNull();
  });

  it('gives each password field its own eye', () => {
    expect(el().querySelectorAll('[data-testid="password-eye"]').length).toBe(2);
  });

  it('keeps the submit button disabled until the password is strong and confirmed', () => {
    const submit = el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBeTrue();
    fixture.componentInstance.passwordForm.setValue({ password: 'Nueva-Clave-2026!', password_confirmation: 'Nueva-Clave-2026!' });
    fixture.detectChanges();
    expect(submit.disabled).toBeFalse();
  });

  it('shows a password error returned by the server under the field', () => {
    fixture.componentInstance.serverErrors.set({ password: 'La contraseña no cumple la política.' });
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="password-server-error"]')!.textContent).toContain('La contraseña no cumple la política.');
  });
});
