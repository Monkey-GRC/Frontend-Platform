import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/domain/services/auth.service';
import { ResetPassword } from './reset-password';

const STRONG = 'Segunda-Clave-2026!';

describe('ResetPassword (SEG-14, D101)', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let fixture: ComponentFixture<ResetPassword>;

  function setup(token: string | null): void {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['resetPassword']);
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => token } } } },
      ],
    });
    fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const fill = (password: string, confirm: string, code: string): void => {
    const c = fixture.componentInstance;
    c.form.setValue({ password, password_confirmation: confirm });
    c.code.set(code);
    fixture.detectChanges();
  };

  it('shows the invalid-link state when the email link has no token', () => {
    setup(null);
    expect(el().querySelector('[data-testid="reset-invalid"]')).not.toBeNull();
    expect(el().querySelector('form')).toBeNull();
  });

  it('does not send until the password is strong, confirmed and the code is complete', () => {
    setup('tok');
    fill('corta', 'corta', '123456');
    fixture.componentInstance.submit();
    expect(auth.resetPassword).not.toHaveBeenCalled();
    fill(STRONG, 'Otra-Clave-2026!', '123456');
    fixture.componentInstance.submit();
    expect(auth.resetPassword).not.toHaveBeenCalled();
    fill(STRONG, STRONG, '123');
    fixture.componentInstance.submit();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the token, the new password and the app code, then shows the done state', () => {
    setup('tok-123');
    auth.resetPassword.and.returnValue(of(void 0));
    fill(STRONG, STRONG, '123456');
    fixture.componentInstance.submit();
    expect(auth.resetPassword).toHaveBeenCalledOnceWith({ token: 'tok-123', new_password: STRONG, code: '123456' });
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="reset-done"]')).not.toBeNull();
  });

  it('sends a recovery code instead of the app code when the person chose it', () => {
    setup('tok');
    auth.resetPassword.and.returnValue(of(void 0));
    fixture.componentInstance.useRecovery.set(true);
    fixture.componentInstance.recoveryCode.set('K7QWM-3PZ9T');
    fixture.componentInstance.form.setValue({ password: STRONG, password_confirmation: STRONG });
    fixture.componentInstance.submit();
    expect(auth.resetPassword).toHaveBeenCalledOnceWith({ token: 'tok', new_password: STRONG, recovery_code: 'K7QWM-3PZ9T' });
  });

  it('turns an expired or used link into the invalid-link state, keeping nothing to retry', () => {
    setup('tok');
    auth.resetPassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'PASSWORD_RESET_INVALID' }, message: 'x' } })));
    fill(STRONG, STRONG, '123456');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="reset-invalid"]')).not.toBeNull();
  });

  it('keeps the form and shows the server message when the code is wrong', () => {
    setup('tok');
    auth.resetPassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'MFA_CODE_INVALID' }, message: 'Ese código no es correcto.' } })));
    fill(STRONG, STRONG, '000000');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.componentInstance.errorMessage()).toBe('Ese código no es correcto.');
    expect(el().querySelector('form')).not.toBeNull();
    expect(el().querySelector('[data-testid="reset-invalid"]')).toBeNull();
  });
});
