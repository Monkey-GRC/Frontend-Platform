import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Route, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { authGuard } from '@core/domain/guards/auth.guard';
import { routes } from './app.routes';

// Las rutas con su `roleGuard` (D136, SEG-85): lo que el menú oculta, el guard también lo niega, y quien no puede entrar vuelve al inicio (que lo lleva a su pantalla de entrada).
// Aquí solo se prueban las rutas cuyos guards son todos `roleGuard` (los demás piden servicios que no son del caso).
function flatten(list: Route[], prefix = ''): { path: string; route: Route; guards: CanActivateFn[] }[] {
  return list.flatMap((r) => {
    const path = [prefix, r.path].filter(Boolean).join('/');
    const own = (r.canActivate ?? []) as CanActivateFn[];
    const children = flatten(r.children ?? [], path).map((c) => ({ ...c, guards: [...own, ...c.guards] }));
    return [{ path, route: r, guards: own }, ...children];
  });
}

describe('the role guards of the routes', () => {
  const all = flatten(routes);
  const guardsOf = (path: string): CanActivateFn[] => {
    const found = all.find((r) => r.path === path && (r.route.loadComponent || r.route.children));
    if (!found) throw new Error(`no route ${path}`);
    return found.guards;
  };
  const canEnter = (path: string, role: string): boolean => {
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    const router = TestBed.inject(Router);
    return guardsOf(path).every((g) => {
      const result = TestBed.runInInjectionContext(() => g({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
      if (result === true) return true;
      expect(result instanceof UrlTree && router.serializeUrl(result)).toBe('/');
      return false;
    });
  };
  const who = (path: string): string[] => ['admin_empresa', 'responsable', 'delegado', 'auditor', 'colaborador'].filter((role) => canEnter(path, role));

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('never lets the collaborator into compliance, services, team, assignment, integrations, responsibles or the library', () => {
    for (const path of ['services', 'services/:id', 'services/new', 'cumplimiento', 'cumplimiento/controles', 'cumplimiento/riesgos', 'cumplimiento/evidencias', 'equipo', 'asignacion', 'integraciones', 'integraciones/agregar', 'integraciones/:code', 'responsables', 'documentos', 'onboarding']) {
      expect(canEnter(path, 'colaborador')).withContext(path).toBeFalse();
    }
  });

  it('never lets the collaborator into «Mi trabajo»: not the screen of Por aprobar (canMatch) nor the delegate one (guard)', () => {
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'colaborador' }, { id: 'c', name: 'ACME' });
    const [review, provisional] = all.filter((r) => r.path === 'mi-trabajo' && r.route.loadComponent);
    expect(TestBed.runInInjectionContext(() => (review.route.canMatch![0] as (...a: unknown[]) => boolean)({}, []))).toBeFalse();
    expect((provisional.route.canActivate ?? []).length).toBe(1);
    const denied = TestBed.runInInjectionContext(() => (provisional.route.canActivate![0] as CanActivateFn)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(denied instanceof UrlTree).toBeTrue();
  });

  it('lets the delegate into compliance but not into its summary', () => {
    expect(who('cumplimiento')).toContain('delegado');
    expect(who('cumplimiento/controles')).toContain('delegado');
    expect(who('cumplimiento/resumen')).toEqual(['admin_empresa', 'responsable', 'auditor']);
  });

  it('opens the library to the administrator and the auditor, and «Mis documentos» to whoever can accept (never the auditor)', () => {
    expect(who('documentos')).toEqual(['admin_empresa', 'auditor']);
    expect(who('mis-documentos')).toEqual(['admin_empresa', 'responsable', 'delegado', 'colaborador']);
    expect(who('mis-documentos/:id')).toEqual(['admin_empresa', 'responsable', 'delegado', 'colaborador']);
  });

  it('keeps creating and editing a service for the administrator, and reading them for the roles of the matrix', () => {
    expect(who('services/new')).toEqual(['admin_empresa']);
    expect(who('services/:id/edit')).toEqual(['admin_empresa']);
    expect(who('services')).toEqual(['admin_empresa', 'responsable', 'delegado', 'auditor']);
  });

  it('keeps the team for the administrator and the owner (their team), and the responsibles for the administrator and the auditor', () => {
    expect(who('equipo')).toEqual(['admin_empresa', 'responsable']);
    expect(who('responsables')).toEqual(['admin_empresa', 'auditor']);
  });

  it('keeps the connection of a platform for whoever sees the technical control', () => {
    expect(who('services/:id/connections/:assetId')).toEqual(['admin_empresa', 'auditor']);
  });

  it('opens «Asignación» to the administrator (owner and delegate) and the owner (delegate), and to nobody else', () => {
    expect(who('asignacion')).toEqual(['admin_empresa', 'responsable']);
  });

  it('renames the notices page to «notificaciones» and keeps `/avisos` as a redirect that preserves the query (old links and emails)', () => {
    const redirect = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'avisos');
    expect(redirect?.redirectTo).toBe('/notificaciones');
    expect(routes.some((r) => r.path === 'notificaciones' && !!r.loadComponent)).toBeTrue();
  });

  it('has «notificaciones» as a full page outside the shell, behind the session guard, and `ventana` redirects to it', () => {
    const route = routes.find((r) => r.path === 'notificaciones');
    expect(route).toBeDefined();
    expect(route!.canActivate).toEqual([authGuard]);
    expect(routes.indexOf(route!)).toBeLessThan(routes.findIndex((r) => r.component === AppLayoutComponent));
    expect(routes.find((r) => r.path === 'notificaciones/ventana')?.redirectTo).toBe('notificaciones');
    expect(all.filter((r) => r.path.endsWith('notificaciones') && !!r.route.loadComponent && r.path !== 'ajustes/notificaciones').length).toBe(1);
  });
});
