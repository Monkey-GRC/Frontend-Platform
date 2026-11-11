import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';
import { ActiveComplianceService } from '../services/active-compliance.service';
import { legacyComplianceRedirectGuard } from './legacy-compliance-redirect.guard';

@Component({ template: '' })
class Blank {}

// Las rutas viejas `/services/:id/cumplimiento/...` redirigen a `/cumplimiento/<sección>` y dejan ese servicio como activo.
describe('legacyComplianceRedirectGuard (routes as app.routes.ts declares them)', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'cumplimiento/:section', component: Blank },
          { path: 'services/:id/cumplimiento', pathMatch: 'full', canActivate: [legacyComplianceRedirectGuard], children: [] },
          { path: 'services/:id/cumplimiento/:tab', canActivate: [legacyComplianceRedirectGuard], children: [] },
        ]),
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
    router = TestBed.inject(Router);
  });

  it('sends a tab to the same section and sets the service as the active one', async () => {
    await router.navigateByUrl('/services/s2/cumplimiento/riesgos');
    expect(router.url).toBe('/cumplimiento/riesgos');
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s2');
  });

  it('sends the module with no tab to the Summary', async () => {
    await router.navigateByUrl('/services/s2/cumplimiento');
    expect(router.url).toBe('/cumplimiento/resumen');
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s2');
  });

  it('keeps the old name «acciones» pointing to Controls, and an unknown tab goes to the Summary', async () => {
    await router.navigateByUrl('/services/s2/cumplimiento/acciones');
    expect(router.url).toBe('/cumplimiento/controles');
    await router.navigateByUrl('/services/s2/cumplimiento/nada');
    expect(router.url).toBe('/cumplimiento/resumen');
  });

  it('keeps the query parameters (a risk or cause to open)', async () => {
    await router.navigateByUrl('/services/s1/cumplimiento/causas?abrir=c1');
    expect(router.url).toBe('/cumplimiento/causas?abrir=c1');
  });
});
