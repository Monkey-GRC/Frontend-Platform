import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  let service: OverviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OverviewService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('asks for the compliance overview of the service and unwraps the envelope', () => {
    let got: unknown;
    service.get('s1').subscribe((o) => (got = o));
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/compliance-overview'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('view')).toBeFalse();
    req.flush({ statusCode: 200, message: 'ok', data: { service_id: 's1', frameworks: [] } });
    expect(got).toEqual({ service_id: 's1', frameworks: [] });
  });

  it('adds ?view=technical only when asked', () => {
    service.get('s1', 'technical').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/compliance-overview'));
    expect(req.request.params.get('view')).toBe('technical');
    req.flush({ statusCode: 200, message: 'ok', data: { service_id: 's1', frameworks: [] } });
  });

  it('declares the period of a framework with a PUT and unwraps the answer (D87)', () => {
    let got: unknown;
    service.setEvaluationPeriod('s1', 'soc2', { period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: null }).subscribe((r) => (got = r));
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/frameworks/soc2/evaluation-period'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: null });
    const data = { framework_code: 'soc2', catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: '2026-10-20', cutoff_frozen: false };
    req.flush({ statusCode: 200, message: 'ok', data });
    expect(got).toEqual(data);
  });
});
