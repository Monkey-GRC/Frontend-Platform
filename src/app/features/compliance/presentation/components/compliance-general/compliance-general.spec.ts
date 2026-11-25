import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ComplianceServiceRef } from '@features/compliance/domain/models/compliance.models';
import { ComplianceOverview, OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { SessionService } from '@core/domain/services/session.service';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { ComplianceGeneral } from './compliance-general';

const fw = (over: Partial<OverviewFramework> = {}): OverviewFramework =>
  ({
    framework_code: 'soc2',
    name: 'SOC 2',
    readiness: 'needs_work',
    progress: { done: 1, total: 4 },
    coverage: { measured: 2, applicable: 4 },
    evaluation: {},
    categories: [],
    ...over,
  }) as OverviewFramework;
const overview = (id: string, frameworks: OverviewFramework[]): ComplianceOverview => ({ service_id: id, frameworks });
const SERVICES: ComplianceServiceRef[] = [
  { id: 's1', name: 'Facturación', frameworks: [{ code: 'soc2', status: 'active' }] },
  { id: 's2', name: 'Nómina', frameworks: [{ code: 'soc2', status: 'active' }] },
  { id: 's3', name: 'Intranet', frameworks: [] },
];

@Component({ selector: 'app-host', imports: [ComplianceGeneral], template: '<app-compliance-general [services]="services" />' })
class Host {
  services = SERVICES;
}

describe('ComplianceGeneral', () => {
  let fixture: ComponentFixture<Host>;
  let api: jasmine.SpyObj<OverviewService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function setup(role = 'admin_empresa') {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: OverviewService, useValue: api },
        { provide: ComplianceViewService, useValue: { viewParam: () => undefined } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj('OverviewService', ['get']);
  });

  it('lists every service under the framework it has, each with its own result, and links to its detail', () => {
    api.get.and.callFake((id: string) => of(overview(id, [fw(id === 's2' ? { readiness: 'ready', progress: { done: 4, total: 4 } } : {})])));
    setup();
    // Un solo marco: sin fila de grupo (data-table no la pinta con un solo grupo; el marco ya está en el banner).
    expect(el().querySelectorAll('[data-group-header]').length).toBe(0);
    const rows = Array.from(el().querySelectorAll('[data-service-row]'));
    expect(rows.map((r) => r.textContent)).toEqual([jasmine.stringContaining('Facturación'), jasmine.stringContaining('Nómina')]);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/cumplimiento/resumen?servicio=s1', '/cumplimiento/resumen?servicio=s2']);
    // Cada servicio con su propio avance: ninguno se combina con otro.
    expect(el().querySelectorAll('[data-progress]').length).toBe(2);
    expect(api.get).toHaveBeenCalledTimes(2); // el servicio sin marco no se pide
  });

  it('keeps showing the other services when one summary cannot be read', () => {
    api.get.and.callFake((id: string) => (id === 's1' ? throwError(() => new Error('500')) : of(overview(id, [fw()]))));
    setup();
    expect(el().querySelectorAll('[data-service-row]').length).toBe(1);
    expect(el().textContent).toContain('Nómina');
  });

  it('offers the services without a framework apart, so they can still be opened', () => {
    api.get.and.callFake((id: string) => of(overview(id, [fw()])));
    setup();
    expect(el().textContent).toContain('Intranet');
    expect(el().textContent).toContain('COMPLIANCE.ENTRY.NO_FRAMEWORK');
  });

  // D136: el delegado ya no recibe el Resumen (`403`): no se le pide el avance de cada servicio y la lista lo lleva a los controles.
  it('does not ask the delegate for the summary of each service, and links every service to its controls', () => {
    setup('delegado');
    expect(api.get).not.toHaveBeenCalled();
    const rows = Array.from(el().querySelectorAll('[data-service-row]'));
    expect(rows.map((r) => r.textContent)).toEqual([jasmine.stringContaining('Facturación'), jasmine.stringContaining('Nómina'), jasmine.stringContaining('Intranet')]);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/cumplimiento/controles?servicio=s1', '/cumplimiento/controles?servicio=s2', '/cumplimiento/controles?servicio=s3']);
    expect(el().querySelectorAll('[data-progress]').length).toBe(0);
  });

  it('keeps asking the summary for the administrator, the owner and the auditor', () => {
    for (const role of ['admin_empresa', 'responsable', 'auditor']) {
      TestBed.resetTestingModule();
      api = jasmine.createSpyObj('OverviewService', ['get']);
      api.get.and.callFake((id: string) => of(overview(id, [fw()])));
      setup(role);
      expect(api.get).toHaveBeenCalledTimes(2);
    }
  });
});
