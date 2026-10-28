import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { SessionService } from '../services/session.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const run = (...roles: string[]) =>
    TestBed.runInInjectionContext(() => roleGuard(...roles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  const signIn = (role: string) => TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('lets the allowed roles in', () => {
    signIn('admin_empresa');
    expect(run('admin_empresa')).toBeTrue();
  });

  it('sends everybody else to the start, including a visitor without a session', () => {
    signIn('funcional');
    const denied = run('admin_empresa') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/');
    TestBed.inject(SessionService).clear();
    expect(TestBed.inject(Router).serializeUrl(run('admin_empresa') as UrlTree)).toBe('/');
  });
});
