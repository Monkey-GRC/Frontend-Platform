import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from '../models/dashboard.models';
import { HomeDashboardService } from './dashboard.service';

const envelope = (data: unknown) => ({ statusCode: 200, message: 'ok', data });

describe('HomeDashboardService', () => {
  let service: HomeDashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HomeDashboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const url = (suffix: string) => (r: { url: string }) => r.url.endsWith(suffix);

  it('has nothing to show when the company has no services', () => {
    let got: Dashboard | undefined;
    service.load(true).subscribe((d) => (got = d));
    http.expectOne(url('/services')).flush(envelope({ items: [], total: 0 }));
    expect(got).toEqual({ services: [] });
  });

  it('gathers the counts and the compliance of every service, asking for the technical view when told', () => {
    let got: Dashboard | undefined;
    service.load(true).subscribe((d) => (got = d));
    http.expectOne(url('/services')).flush(envelope({ items: [{ id: 's1', name: 'Datafunction' }], total: 1 }));
    http.expectOne((r) => r.url.endsWith('/assets') && r.params.get('service_id') === 's1').flush(envelope({ items: [], total: 5 }));
    http.expectOne((r) => r.url.endsWith('/services/s1/risks') && !r.params.has('evaluated')).flush(envelope({ items: [], total: 10 }));
    http.expectOne((r) => r.url.endsWith('/services/s1/risks') && r.params.get('evaluated') === 'true').flush(envelope({ items: [], total: 4 }));
    http.expectOne(url('/services/s1/causes')).flush(envelope({ items: [], total: 56 }));
    const overview = http.expectOne((r) => r.url.endsWith('/services/s1/compliance-overview'));
    expect(overview.request.params.get('view')).toBe('technical');
    overview.flush(
      envelope({
        service_id: 's1',
        frameworks: [
          {
            framework_code: 'soc2', name: 'SOC 2', readiness: 'needs_work', progress: { done: 0, total: 86 }, coverage: { measured: 22, applicable: 86 },
            categories: [
              { failing_controls: [{ control_id: 'k1', code: 'IAC-12', name: 'Accesos' }] },
              { failing_controls: [{ control_id: 'k1', code: 'IAC-12', name: 'Accesos' }, { control_id: 'k2', code: 'MON-3', name: 'Monitoreo' }] },
            ],
            technical: { state: 'non_compliant' },
          },
        ],
      }),
    );
    expect(got!.services).toEqual([
      {
        id: 's1', name: 'Datafunction', assets: 5, risks: 10, risksEvaluated: 4, causes: 56, controls: 86,
        frameworks: [{ code: 'soc2', name: 'SOC 2', readiness: 'needs_work', verdict: 'non_compliant', progress: { done: 0, total: 86 }, coverage: { measured: 22, applicable: 86 } }],
        failing: [{ controlId: 'k1', code: 'IAC-12', name: 'Accesos' }, { controlId: 'k2', code: 'MON-3', name: 'Monitoreo' }],
      },
    ]);
  });

  it('a count that cannot be read stays at zero instead of taking the whole panel down', () => {
    let got: Dashboard | undefined;
    service.load(false).subscribe((d) => (got = d));
    http.expectOne(url('/services')).flush(envelope({ items: [{ id: 's1', name: 'Servicio' }], total: 1 }));
    http.expectOne((r) => r.url.endsWith('/assets')).flush('x', { status: 500, statusText: 'Error' });
    http.match((r) => r.url.endsWith('/services/s1/risks')).forEach((r) => r.flush(envelope({ items: [], total: 3 })));
    http.expectOne(url('/services/s1/causes')).flush(envelope({ items: [], total: 2 }));
    const overview = http.expectOne((r) => r.url.endsWith('/compliance-overview'));
    expect(overview.request.params.has('view')).toBeFalse();
    overview.flush('x', { status: 403, statusText: 'Forbidden' });
    expect(got!.services[0]).toEqual(jasmine.objectContaining({ assets: 0, risks: 3, causes: 2, frameworks: [], failing: [], controls: 0 }));
  });
});
