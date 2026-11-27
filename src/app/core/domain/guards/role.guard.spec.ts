import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { SessionService } from '../services/session.service';
import { roleGuard, roleMatch } from './role.guard';

describe('roleGuard', () => {
  const run = (...roles: string[]) =>
    TestBed.runInInjectionContext(() => roleGuard(...roles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  const signIn = (role: string) => TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('lets the allowed roles in', () => {
    signIn('admin_empresa');
    expect(run('admin_empresa')).toBeTrue();
  });

  it('protects the onboarding route for the company admin only', async () => {
    const { routes } = await import('../../../app.routes');
    const shell = routes.find((r) => r.children?.some((c) => c.path === 'onboarding'));
    const onboarding = shell?.children?.find((c) => c.path === 'onboarding');
    expect(onboarding?.canActivate?.length).toBe(1);
    const guard = onboarding?.canActivate?.[0] as CanActivateFn;
    signIn('responsable');
    const denied = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/');
    signIn('admin_empresa');
    expect(TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBeTrue();
  });

  it('sends everybody else to the start, including a visitor without a session', () => {
    signIn('responsable');
    const denied = run('admin_empresa') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/');
    TestBed.inject(SessionService).clear();
    expect(TestBed.inject(Router).serializeUrl(run('admin_empresa') as UrlTree)).toBe('/');
  });

  describe('roleMatch', () => {
    const match = (...roles: string[]) => TestBed.runInInjectionContext(() => roleMatch(...roles)({} as never, []));

    it('matches only the given roles, so the route falls through to the next one for the rest', () => {
      signIn('admin_empresa');
      expect(match('responsable', 'admin_empresa')).toBeTrue();
      signIn('delegado');
      expect(match('responsable', 'admin_empresa')).toBeFalse();
      TestBed.inject(SessionService).clear();
      expect(match('responsable', 'admin_empresa')).toBeFalse();
    });

    it('splits Mi trabajo: Por aprobar for the owner and the admin, the provisional screen for the delegate', async () => {
      const { routes } = await import('../../../app.routes');
      const shell = routes.find((r) => r.children?.some((c) => c.path === 'mi-trabajo'));
      const screens = shell?.children?.filter((c) => c.path === 'mi-trabajo') ?? [];
      expect(screens.length).toBe(2);
      expect(screens[0].canMatch?.length).toBe(1);
      expect(screens[1].canActivate?.length).toBe(1);
    });
  });
});
