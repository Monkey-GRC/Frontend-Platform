import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { SessionService } from '../services/session.service';
import { workLandingGuard } from './work-landing.guard';

describe('workLandingGuard (D102, MD-196)', () => {
  const run = () => TestBed.runInInjectionContext(() => workLandingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  const signIn = (role: string) => TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('sends the owner and the delegate to «Mi trabajo» instead of the company start', () => {
    for (const role of ['responsable', 'delegado']) {
      signIn(role);
      expect(TestBed.inject(Router).serializeUrl(run() as UrlTree)).toBe('/mi-trabajo');
    }
  });

  it('sends the collaborator to «Mis documentos»: it has nothing else', () => {
    signIn('colaborador');
    expect(TestBed.inject(Router).serializeUrl(run() as UrlTree)).toBe('/mis-documentos');
  });

  it('lets the administrator and the auditor into the start as before', () => {
    for (const role of ['admin_empresa', 'auditor']) {
      signIn(role);
      expect(run()).toBeTrue();
    }
  });
});
