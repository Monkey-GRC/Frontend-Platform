import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthPayloadWithRecovery, MfaSetupStart } from '@core/domain/models/auth.models';
import { AuthService } from '@core/domain/services/auth.service';
import { MfaForm } from './mfa-form';

const SETUP: MfaSetupStart = { secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/Monkey:ana@acme.co?secret=JBSWY3DPEHPK3PXP', issuer: 'Monkey', account: 'ana@acme.co' };

describe('MfaForm · activar el segundo factor, QR y códigos de recuperación', () => {
  let fixture: ComponentFixture<MfaForm>;
  let auth: jasmine.SpyObj<AuthService> & { pendingMfa: ReturnType<typeof signal> };
  const el = () => fixture.nativeElement as HTMLElement;
  const component = () => fixture.componentInstance;
  const secondary = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button.mk-btn-secondary'));

  beforeEach(() => {
    auth = Object.assign(jasmine.createSpyObj<AuthService>('AuthService', ['startMfaSetup', 'confirmMfaSetup', 'finishMfaSetup']), {
      pendingMfa: signal({ next_step: 'mfa_setup' } as unknown),
    }) as typeof auth;
    TestBed.configureTestingModule({
      imports: [MfaForm],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: AuthService, useValue: auth }],
    });
    fixture = TestBed.createComponent(MfaForm);
    fixture.detectChanges();
  });

  describe('activar', () => {
    it('starts on the install step when the factor is not set up yet', () => {
      expect(component().stage()).toBe('install');
      expect(component().setupStep).toBe(1);
    });

    it('asks the server for the secret, goes to the QR step with it hidden, and then to the first code', () => {
      auth.startMfaSetup.and.returnValue(of(SETUP));
      el().querySelector<HTMLButtonElement>('button.mk-btn')!.click();
      fixture.detectChanges();
      expect(auth.startMfaSetup).toHaveBeenCalledTimes(1);
      expect(component().stage()).toBe('scan');
      expect(component().setup()).toEqual(SETUP);
      expect(component().qrRevealed()).toBeFalse();
      expect(component().setupStep).toBe(2);
      component().toConfirm();
      expect(component().stage()).toBe('confirm');
    });

    it('confirms the first code, keeps the recovery codes and moves to the last step without opening the session yet', () => {
      component().stage.set('confirm');
      auth.confirmMfaSetup.and.returnValue(of({ recovery_codes: ['aaaa-bbbb', 'cccc-dddd'] } as unknown as AuthPayloadWithRecovery));
      component().submitCode('123456');
      fixture.detectChanges();
      expect(auth.confirmMfaSetup).toHaveBeenCalledOnceWith('123456');
      expect(component().stage()).toBe('codes');
      expect(component().recoveryCodes()).toEqual(['aaaa-bbbb', 'cccc-dddd']);
      expect(el().querySelectorAll('ul li').length).toBe(2);
      expect(auth.finishMfaSetup).not.toHaveBeenCalled();
    });
  });

  describe('mostrar y ocultar el QR', () => {
    beforeEach(() => {
      component().setup.set(SETUP);
      component().stage.set('scan');
      fixture.detectChanges();
    });

    it('does not draw the QR nor the manual key until the person asks, and keeps "I scanned it" disabled', () => {
      expect(el().querySelector('app-qr-code')).toBeNull();
      expect(el().textContent).not.toContain(SETUP.secret);
      const next = Array.from(el().querySelectorAll<HTMLButtonElement>('button.mk-btn')).pop()!;
      expect(next.disabled).toBeTrue();
    });

    it('reveals the QR and the key on click, and hides them again', () => {
      el().querySelector<HTMLButtonElement>('button.border-dashed')!.click();
      fixture.detectChanges();
      expect(component().qrRevealed()).toBeTrue();
      expect(el().querySelector('app-qr-code')).not.toBeNull();
      expect(el().textContent).toContain(SETUP.secret);
      const next = Array.from(el().querySelectorAll<HTMLButtonElement>('button.mk-btn')).pop()!;
      expect(next.disabled).toBeFalse();

      const hide = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes('AUTH.MFA.QR_HIDE'))!;
      hide.click();
      fixture.detectChanges();
      expect(component().qrRevealed()).toBeFalse();
      expect(el().querySelector('app-qr-code')).toBeNull();
    });
  });

  describe('códigos de recuperación: copiar y descargar', () => {
    const CODES = ['aaaa-bbbb', 'cccc-dddd'];
    let writeText: jasmine.Spy;
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

    beforeEach(() => {
      writeText = jasmine.createSpy('writeText').and.resolveTo();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component().recoveryCodes.set(CODES);
      component().stage.set('codes');
      fixture.detectChanges();
    });

    afterEach(() => {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as Record<string, unknown>)['clipboard'];
    });

    it('copies all the codes, one per line, and shows the confirmation for two seconds', fakeAsync(() => {
      secondary()[0].click();
      flushMicrotasks();
      fixture.detectChanges();
      expect(writeText).toHaveBeenCalledOnceWith('aaaa-bbbb\ncccc-dddd');
      expect(component().copied()).toBe('codes');
      expect(secondary()[0].textContent).toContain('AUTH.MFA.COPIED');
      tick(2000);
      fixture.detectChanges();
      expect(component().copied()).toBeNull();
    }));

    it('does not fail when the browser refuses the clipboard', fakeAsync(() => {
      writeText.and.rejectWith(new Error('denied'));
      secondary()[0].click();
      flushMicrotasks();
      expect(component().copied()).toBeNull();
    }));

    it('downloads a text file with the header and the codes, and releases the temporary URL', async () => {
      const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:codes');
      const revoke = spyOn(URL, 'revokeObjectURL');
      const click = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
      secondary()[1].click();
      expect(click).toHaveBeenCalledTimes(1);
      expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('monkey-codigos-de-recuperacion.txt');
      const blob = create.calls.mostRecent().args[0] as Blob;
      expect(blob.type).toContain('text/plain');
      const text = await blob.text();
      expect(text).toContain('AUTH.MFA.CODES_FILE_HEADER');
      expect(text).toContain('aaaa-bbbb\ncccc-dddd');
      expect(revoke).toHaveBeenCalledOnceWith('blob:codes');
    });
  });

  // La casilla «ya guardé mis códigos» usa `targetChecked`: al marcarla, el modelo (`saved`) se actualiza.
  describe('códigos de recuperación guardados', () => {
    beforeEach(() => {
      component().stage.set('codes');
      component().recoveryCodes.set(['aaaa-bbbb', 'cccc-dddd']);
      fixture.detectChanges();
    });

    it('updates the model when the checkbox is ticked and unticked', () => {
      const box = el().querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(component().saved()).toBeFalse();
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      expect(component().saved()).toBeTrue();
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      expect(component().saved()).toBeFalse();
    });
  });
});
