import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@core/domain/services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let validate: jasmine.Spy;

  function setup(inMemorySession: boolean, serverSays: boolean): void {
    validate = jasmine.createSpy('validate').and.returnValue(of(serverSays));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { validate } }] });
    if (inMemorySession) {
      TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c1', name: 'ACME' });
    }
  }

  const run = async (): Promise<boolean | string> => {
    const out = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const result = out instanceof Observable ? await firstValueFrom(out) : (out as boolean | UrlTree);
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
  };

  it('lets a loaded session through at once, without waiting for a round trip to the server', async () => {
    setup(true, false);
    expect(await run()).toBeTrue();
    expect(validate).not.toHaveBeenCalled();
  });

  it('asks the server when there is no session in memory (a fresh load) and lets a valid one in', async () => {
    setup(false, true);
    expect(await run()).toBeTrue();
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('sends someone with no valid session to the sign-in', async () => {
    setup(false, false);
    expect(await run()).toBe('/signin');
  });
});
