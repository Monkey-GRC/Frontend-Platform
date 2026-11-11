import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '@core/domain/services/auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword (pantalla dividida, como el login)', () => {
  function setup() {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['forgotPassword']);
    TestBed.configureTestingModule({ imports: [ForgotPassword], providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), { provide: AuthService, useValue: auth }] });
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    return { fixture, auth, el: fixture.nativeElement as HTMLElement };
  }

  it('lives inside the split auth layout, with a container that takes its half (flex-1) next to the brand panel', () => {
    const { el } = setup();
    const layout = el.querySelector('app-auth-page-layout')!;
    expect(layout).not.toBeNull();
    const half = Array.from(layout.querySelectorAll('div')).find((d) => d.classList.contains('flex-1') && d.classList.contains('flex-col'));
    expect(half).toBeDefined();
    expect(el.textContent).toContain('AUTH.LAYOUT.TAGLINE'); // el panel de la marca
  });

  it('asks for the email and shows the generic confirmation, which does not say whether the account exists', () => {
    const { fixture, auth, el } = setup();
    auth.forgotPassword.and.returnValue(of(void 0));
    fixture.componentInstance.form.setValue({ email: 'Ana@Acme.co ' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.forgotPassword).toHaveBeenCalledOnceWith('ana@acme.co');
    expect(el.querySelector('[data-testid="forgot-sent"]')).not.toBeNull();
  });
});
