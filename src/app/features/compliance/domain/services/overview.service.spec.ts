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
});
