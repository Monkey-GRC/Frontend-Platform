import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { RiskService } from '@features/compliance/domain/services/risk.service';
import { RiskReadinessService } from '@features/compliance/domain/services/risk-readiness.service';
import { RiskProgress } from '@features/compliance/domain/utils/risk-progress';
import { TechnicalControlService } from '@features/technical-control/domain/services/technical-control.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceService } from '../../../domain/services/service.service';
import { ServiceDetailView } from './service-detail';

// D89 · Antes de declarar los activos de un servicio se evalúan sus riesgos: el botón «Nueva conexión» queda cerrado y el aviso lleva a evaluarlos.
describe('ServiceDetailView — risks before assets (D89)', () => {
  let fixture: ComponentFixture<ServiceDetailView>;

  const progress = (pending: number, total = 10): RiskProgress => ({ total, evaluated: total - pending, pending, ready: pending === 0 });
  const SERVICE = {
    id: 's1', name: 'Soporte', description: 'x', scope_statement: 'x', type: 'service_desk', industries_served: [], active_client_count: null, countries: [], data_types: [],
    trust_criteria: ['security'], subservice_organizations: [], frameworks: [{ code: 'soc2', status: 'active' }], previous_certification: null, expected_availability: '24x7',
    system_description: null, catalog: { applicable_requirements: 1, cloned_controls: 1 },
  };

  function setup(risks: Observable<RiskProgress>, query: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [ServiceDetailView],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 's1' }), queryParamMap: convertToParamMap(query) } } },
        { provide: RiskService, useValue: { listAllRisks: () => of([]), getRisk: () => of(), evaluate: () => of() } },
        { provide: ServiceService, useValue: { get: () => of(SERVICE) } },
        { provide: TechnicalControlService, useValue: { state: () => of({ deployment_scenario: 'cloud_only', applicable_capabilities: [] }), listAssets: () => of({ items: [], total: 0 }) } },
        { provide: CatalogService, useValue: { options: () => of([]) } },
        { provide: AuthService, useValue: { validate: () => of(true) } },
        { provide: RiskReadinessService, useValue: { progress: () => risks } },
      ],
    });
    fixture = TestBed.createComponent(ServiceDetailView);
    fixture.detectChanges();
  }

  const q = (s: string) => (fixture.nativeElement as HTMLElement).querySelector(s);

  it('closes "new connection" and sends to evaluate the risks while any is missing', () => {
    setup(of(progress(4)));
    expect(q('[data-new-connection-blocked]')).not.toBeNull();
    expect(q('a[href="/services/s1/connections/new"]')).toBeNull();
    const gate = q('[data-risk-gate]')!;
    expect(gate.textContent).toContain('SERVICES.DETAIL.RISKS_FIRST_TITLE');
    expect(gate.querySelector('a')).toBeNull(); // no manda a Cumplimiento: el asistente se abre aquí mismo
  });

  it('opens the risk assistant right there, in place of the connections, from the notice', () => {
    setup(of(progress(4)));
    expect(q('app-risk-wizard')).toBeNull();
    (q('[data-risk-gate-cta]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('[data-risk-wizard]')).not.toBeNull();
    expect(q('app-risk-wizard')).not.toBeNull();
    expect(q('[data-new-connection-blocked]')).toBeNull(); // la tarjeta de conexiones se reemplaza mientras se evalúa
  });

  it('opens the assistant by itself when the person arrives from a connection link with risks still missing', () => {
    setup(of(progress(4)), { evaluar: 'riesgos' });
    expect(q('[data-risk-wizard]')).not.toBeNull();
  });

  it('does not open the assistant from the link when nothing is missing', () => {
    setup(of(progress(0)), { evaluar: 'riesgos' });
    expect(q('[data-risk-wizard]')).toBeNull();
    expect(q('a[href="/services/s1/connections/new"]')).not.toBeNull();
  });

  it('opens "new connection" once every risk is evaluated', () => {
    setup(of(progress(0)));
    expect(q('[data-new-connection-blocked]')).toBeNull();
    expect(q('[data-risk-gate]')).toBeNull();
    expect(q('a[href="/services/s1/connections/new"]')).not.toBeNull();
  });

  it('does not block when it cannot tell how the risks are', () => {
    setup(throwError(() => new Error('down')));
    expect(q('[data-new-connection-blocked]')).toBeNull();
    expect(q('a[href="/services/s1/connections/new"]')).not.toBeNull();
  });
});
