import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ControlService } from './control.service';

describe('ControlService', () => {
  let service: ControlService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ControlService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the page and only the filters that are set, with no view for the business view', () => {
    service.list('s1', { page: 2, pageSize: 25, trustCriterion: 'security', readiness: null }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/controls'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('25');
    expect(req.request.params.get('trust_criterion')).toBe('security');
    expect(req.request.params.has('readiness')).toBeFalse();
    expect(req.request.params.has('view')).toBeFalse();
    req.flush({ statusCode: 200, message: 'control.list', data: { items: [], page: 2, page_size: 25, total: 0, total_pages: 0 } });
  });

  it('sends view=technical only when asked', () => {
    service.list('s1', { page: 1, pageSize: 25 }, 'technical').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/controls'));
    expect(req.request.params.get('view')).toBe('technical');
    req.flush({ statusCode: 200, message: '', data: { items: [], page: 1, page_size: 25, total: 0, total_pages: 0 } });
  });

  it('maps the page the backend sends to the shape of the table', () => {
    let result: unknown;
    service.list('s1', { page: 1, pageSize: 25 }).subscribe((r) => (result = r.page));
    http
      .expectOne((r) => r.url.endsWith('/services/s1/controls'))
      .flush({ statusCode: 200, message: '', data: { items: [], page: 1, page_size: 25, total: 80, total_pages: 4 } });
    expect(result).toEqual({ page: 1, pageSize: 25, total: 80, totalPages: 4 });
  });

  it('proposes a change on the control and does not touch any other resource', () => {
    service.proposeChange('c1', { change_type: 'retire', proposed_values: {} }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/changes'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ change_type: 'retire', proposed_values: {} });
    req.flush({ statusCode: 201, message: 'control_change.requested', data: { id: 'x' } });
  });
});
