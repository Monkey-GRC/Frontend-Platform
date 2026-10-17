import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RiskService } from './risk.service';

describe('RiskService', () => {
  let service: RiskService;
  let http: HttpTestingController;

  const page = (items: unknown[], n: number, pages: number) => ({ statusCode: 200, message: '', data: { items, page: n, page_size: 100, total: 150, total_pages: pages } });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RiskService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the risk matrix once and shares it, so that every screen paints the same levels', () => {
    const got: unknown[] = [];
    service.matrix().subscribe((m) => got.push(m));
    service.matrix().subscribe((m) => got.push(m));
    const req = http.expectOne((r) => r.url.endsWith('/risk-matrix'));
    req.flush({ statusCode: 200, message: '', data: { min: 1, max: 5, cells: [{ likelihood: 5, impact: 5, value: 25, level: 'critical' }] } });
    service.matrix().subscribe((m) => got.push(m));
    http.expectNone((r) => r.url.endsWith('/risk-matrix'));
    expect(got.length).toBe(3);
    expect(got[0]).toBe(got[2]);
  });

  it('loads every page of the risks of the service', () => {
    let result: unknown[] = [];
    service.listAllRisks('s1').subscribe((r) => (result = r));

    const first = http.expectOne((r) => r.url.endsWith('/services/s1/risks') && r.params.get('page') === '1');
    expect(first.request.params.get('page_size')).toBe('100');
    expect(first.request.params.has('view')).toBeFalse();
    first.flush(page([{ id: 'a' }], 1, 2));

    http.expectOne((r) => r.url.endsWith('/services/s1/risks') && r.params.get('page') === '2').flush(page([{ id: 'b' }], 2, 2));
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('asks for a single page when there is only one, and sends the technical view only when asked', () => {
    service.listAllCauses('s1', 'technical').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/causes'));
    expect(req.request.params.get('view')).toBe('technical');
    req.flush(page([], 1, 1));
  });

  it('links and unlinks with the paths of the contract', () => {
    service.linkCause('r1', 'c1').subscribe();
    const link = http.expectOne((r) => r.url.endsWith('/risks/r1/causes'));
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual({ cause_id: 'c1' });
    link.flush({ statusCode: 201, message: '' });

    service.unlinkCause('r1', 'c1').subscribe();
    const unlink = http.expectOne((r) => r.url.endsWith('/risks/r1/causes/c1'));
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush(null, { status: 204, statusText: 'No Content' });

    service.linkControl('c1', 'k1').subscribe();
    const control = http.expectOne((r) => r.url.endsWith('/causes/c1/controls'));
    expect(control.request.body).toEqual({ control_id: 'k1' });
    control.flush({ statusCode: 201, message: '', data: { cause_id: 'c1', control_id: 'k1', is_mandatory: true, effect: null } });

    service.unlinkControl('c1', 'k1').subscribe();
    http.expectOne((r) => r.url.endsWith('/causes/c1/controls/k1')).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('retires a risk and a cause with a DELETE on their own resource', () => {
    service.deactivateRisk('r1').subscribe();
    const risk = http.expectOne((r) => r.url.endsWith('/risks/r1'));
    expect(risk.request.method).toBe('DELETE');
    risk.flush(null, { status: 204, statusText: 'No Content' });

    service.deactivateCause('c1').subscribe();
    http.expectOne((r) => r.url.endsWith('/causes/c1') && r.method === 'DELETE').flush(null, { status: 204, statusText: 'No Content' });
  });
});
