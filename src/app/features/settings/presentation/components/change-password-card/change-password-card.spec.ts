import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { SecurityService } from '@features/settings/domain/services/security.service';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { ChangePasswordCard } from './change-password-card';

const CURRENT = 'Actual-Clave-2026!';
const NEXT = 'Nueva-Clave-2026!';
const apiError = (status: number, code: string, message: string) => new HttpErrorResponse({ status, error: { error: { code }, message } });

describe('ChangePasswordCard (SEG-14, D101)', () => {
  let security: jasmine.SpyObj<SecurityService>;
  let fixture: ComponentFixture<ChangePasswordCard>;

  beforeEach(() => {
    security = jasmine.createSpyObj<SecurityService>('SecurityService', ['changePassword', 'requestPasswordRecovery']);
    TestBed.configureTestingModule({
      imports: [ChangePasswordCard],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: SecurityService, useValue: security }, { provide: SessionService, useValue: { user: () => ({ email: 'ana@acme.co' }) } }],
    });
    fixture = TestBed.createComponent(ChangePasswordCard);
    fixture.detectChanges();
  });

  const card = () => fixture.componentInstance;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(testId: string) => el().querySelector<T>(`[data-testid="${testId}"]`);
  const fill = (current: string, next: string, confirm: string) => card().form.setValue({ current_password: current, password: next, password_confirmation: confirm });

  it('asks for the current password on its own row, before the new one', () => {
    const labels = Array.from(el().querySelectorAll('label')).map((l) => l.getAttribute('for'));
    expect(labels.indexOf('current-password')).toBeLessThan(labels.indexOf('new-password'));
    expect(el().querySelector('app-second-factor-field')).toBeNull(); // el código ya no vive en el formulario
  });

  it('lists the three things to know as a list, not as one long paragraph', () => {
    const box = el().querySelector('[data-testid="password-notes"]')!;
    expect(box.querySelectorAll('li').length).toBe(3);
    expect(box.querySelector('.material-symbols-rounded')).toBeNull(); // una lista sencilla, sin iconos
  });

  it('has an eye on each of the three fields, each working on its own', () => {
    expect(el().querySelectorAll('[data-testid="password-eye"]').length).toBe(3);
  });

  it('does not open the code modal until the current password, a strong new one and its confirmation are right', () => {
    fill('', NEXT, NEXT);
    card().requestChange();
    fill(CURRENT, 'corta', 'corta');
    card().requestChange();
    fill(CURRENT, NEXT, 'Distinta-2026!');
    card().requestChange();
    fill(CURRENT, CURRENT, CURRENT); // la nueva no puede ser la actual
    card().requestChange();
    expect(card().confirming()).toBeFalse();
    expect(security.changePassword).not.toHaveBeenCalled();
  });

  it('disables the button until the form is right', () => {
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('change-password-submit')!.disabled).toBeTrue();
    fill(CURRENT, NEXT, NEXT);
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('change-password-submit')!.disabled).toBeFalse();
  });

  it('opens the code modal when everything is right, and sends nothing yet', () => {
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    fixture.detectChanges();
    expect(card().confirming()).toBeTrue();
    expect(q('factor-dialog')).not.toBeNull();
    expect(security.changePassword).not.toHaveBeenCalled();
  });

  it('cancelling the modal keeps what was typed and sends nothing', () => {
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    card().cancelConfirmation();
    fixture.detectChanges();
    expect(q('factor-dialog')).toBeNull();
    expect(card().form.getRawValue().password).toBe(NEXT);
    expect(security.changePassword).not.toHaveBeenCalled();
  });

  it('sends the three data with the app code once the person confirms, then clears the form and confirms', () => {
    security.changePassword.and.returnValue(of(void 0));
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    card().confirmChange({ code: '123456' });
    expect(security.changePassword).toHaveBeenCalledOnceWith({ current_password: CURRENT, new_password: NEXT, code: '123456' });
    fixture.detectChanges();
    expect(TestBed.inject(ToastService).toasts().map((t) => t.title)).toEqual(['SETTINGS.SECURITY.PASSWORD.DONE']);
    expect(q('factor-dialog')).toBeNull();
    expect(card().form.getRawValue()).toEqual({ current_password: '', password: '', password_confirmation: '' });
  });

  it('sends a recovery code when the person chose it in the modal', () => {
    security.changePassword.and.returnValue(of(void 0));
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    card().confirmChange({ recovery_code: 'K7QWM-3PZ9T' });
    expect(security.changePassword).toHaveBeenCalledOnceWith({ current_password: CURRENT, new_password: NEXT, recovery_code: 'K7QWM-3PZ9T' });
  });

  it('a wrong code is shown inside the modal, which stays open so it can be corrected', () => {
    security.changePassword.and.returnValue(throwError(() => apiError(401, 'MFA_CODE_INVALID', 'Ese código no es correcto.')));
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    card().confirmChange({ code: '000000' });
    fixture.detectChanges();
    expect(card().confirming()).toBeTrue();
    expect(q('factor-error')!.textContent).toContain('Ese código no es correcto.');
    expect(card().form.getRawValue().password).toBe(NEXT);
  });

  it('any other error (wrong current password, reused) closes the modal and is shown in the form, keeping what was typed', () => {
    security.changePassword.and.returnValue(throwError(() => apiError(403, 'CURRENT_PASSWORD_INVALID', 'La contraseña actual no es correcta.')));
    fill(CURRENT, NEXT, NEXT);
    card().requestChange();
    card().confirmChange({ code: '123456' });
    fixture.detectChanges();
    expect(card().confirming()).toBeFalse();
    expect(q('factor-dialog')).toBeNull();
    expect(q('change-password-error')!.textContent).toContain('La contraseña actual no es correcta.');
    expect(card().form.getRawValue().current_password).toBe(CURRENT);
  });

  describe('«¿No la recuerdas?» con la sesión abierta', () => {
    it('does not send the person to another screen: it is a button, not a link', () => {
      const trigger = q('recover-by-email')!;
      expect(trigger.tagName).toBe('BUTTON');
      expect(el().querySelector('a[href*="forgot"]')).toBeNull();
    });

    it('sends the link to the email of the person in session (it already knows it) and tells them where it went', () => {
      security.requestPasswordRecovery.and.returnValue(of(void 0));
      q('recover-by-email')!.click();
      fixture.detectChanges();
      expect(security.requestPasswordRecovery).toHaveBeenCalledOnceWith('ana@acme.co');
      expect(q('notice-dialog')).not.toBeNull();
      // El correo va resaltado en su propio recuadro, no dentro de una frase.
      expect(q('notice-highlight')!.textContent).toBe('ana@acme.co');
    });

    it('closes the notice with its button and leaves the form as it was', () => {
      security.requestPasswordRecovery.and.returnValue(of(void 0));
      fill(CURRENT, NEXT, NEXT);
      q('recover-by-email')!.click();
      fixture.detectChanges();
      q('notice-close')!.click();
      fixture.detectChanges();
      expect(q('notice-dialog')).toBeNull();
      expect(card().form.getRawValue().password).toBe(NEXT);
    });

    it('shows the problem under the link, without the notice, when the email could not be requested', () => {
      security.requestPasswordRecovery.and.returnValue(throwError(() => apiError(429, 'RATE_LIMITED', 'Demasiadas peticiones.')));
      q('recover-by-email')!.click();
      fixture.detectChanges();
      expect(q('notice-dialog')).toBeNull();
      expect(q('recover-error')!.textContent).toContain('Demasiadas peticiones.');
    });

    it('does not ask twice while the first request is in flight', () => {
      security.requestPasswordRecovery.and.returnValue(new Observable<void>(() => undefined));
      q('recover-by-email')!.click();
      fixture.detectChanges();
      card().recoverByEmail();
      expect(security.requestPasswordRecovery).toHaveBeenCalledTimes(1);
      expect(q('recover-by-email')!.getAttribute('aria-busy')).toBe('true');
      expect(q('recover-by-email')!.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
