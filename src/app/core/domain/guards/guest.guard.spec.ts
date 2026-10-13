import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  async function run(hasSession: boolean, nextStep: string | null = null): Promise<boolean | string> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { validate: () => of(hasSession) } }],
    });
    if (hasSession) {
      TestBed.inject(SessionService).set(
        { id: 'u1', email: 'a@x.com', name: null, last_name: null, role: 'admin_empresa' },
        { id: 'c1', name: 'ACME' },
        { next_step: nextStep, completed_steps: [] },
      );
    }
    const result = await firstValueFrom(TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never)) as Observable<boolean | UrlTree>);
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  }

  it('shows the sign-in and activation pages to someone without a session', async () => {
    expect(await run(false)).toBeTrue();
  });

  it('sends someone who is already signed in to the home instead of the login', async () => {
    expect(await run(true, null)).toBe('/');
  });

  it('sends someone who has not told us about their company yet to the onboarding', async () => {
    expect(await run(true, 'organizational_context')).toBe('/onboarding');
  });
});
