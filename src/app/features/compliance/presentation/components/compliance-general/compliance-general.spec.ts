import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ComplianceServiceRef } from '@features/compliance/domain/models/compliance.models';
import { ComplianceOverview, OverviewFramework } from '@features/compliance/domain/models/overview.models';
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

  function setup() {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: OverviewService, useValue: api },
        { provide: ComplianceViewService, useValue: { viewParam: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj('OverviewService', ['get']);
  });

  it('lists every service under the framework it has, each with its own result, and links to its detail', () => {
    api.get.and.callFake((id: string) => of(overview(id, [fw(id === 's2' ? { readiness: 'ready', progress: { done: 4, total: 4 } } : {})])));
    setup();
    const groups = el().querySelectorAll('[data-group-header]');
    expect(groups.length).toBe(1);
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
});
