import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AuthPayload, LoginOutcome } from '@core/domain/models/auth.models';
import { AuthService } from '@core/domain/services/auth.service';
import { LoginForm } from './login-form';

describe('LoginForm · ocupado hasta la respuesta y hasta que termina la navegación (D116)', () => {
  let fixture: ComponentFixture<LoginForm>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const submit = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    TestBed.configureTestingModule({
      imports: [LoginForm],
      providers: [provideRouter([]), provideTranslateService(), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginForm);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ email: 'ana@acme.co', password: 'secret' });
    fixture.detectChanges();
  });

  it('is busy (button and fields) while the request runs, and shows no hand-made spinner', () => {
    auth.login.and.returnValue(new Subject<LoginOutcome>());
    submit().click();
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeTrue();
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(el().querySelector('form')!.hasAttribute('data-busy-fields')).toBeTrue();
    expect(el().querySelector('.animate-spin')).toBeNull();
  });

  it('stays busy after the answer until the navigation finishes', async () => {
    const answer = new Subject<LoginOutcome>();
    auth.login.and.returnValue(answer);
    let finish: (ok: boolean) => void = () => undefined;
    spyOn(router, 'navigateByUrl').and.returnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    submit().click();
    fixture.detectChanges();
    answer.next({ kind: 'session', payload: { user: { role: 'admin_empresa' }, onboarding: null } as unknown as AuthPayload });
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.loading()).toBeTrue();
    finish(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('clears the busy state and shows the error when the request fails', () => {
    const answer = new Subject<LoginOutcome>();
    auth.login.and.returnValue(answer);
    submit().click();
    fixture.detectChanges();
    answer.error({ status: 401 });
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(submit().getAttribute('aria-busy')).toBeNull();
    expect(fixture.componentInstance.errorMessage()).toBeTruthy();
  });
});
