import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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

  it('edits the control in place with PATCH and retires it with DELETE (D96)', () => {
    service.update('c1', { interpretation: { text: 'Nuevo texto.' } }).subscribe();
    const patch = http.expectOne((r) => r.url.endsWith('/controls/c1'));
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ interpretation: { text: 'Nuevo texto.' } });
    patch.flush({ statusCode: 200, message: 'control.updated', data: { id: 'c1' } });

    service.retire('c1').subscribe();
    const del = http.expectOne((r) => r.url.endsWith('/controls/c1'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  describe('setPeriodicity (D147)', () => {
    const body = { periodicity: 'monthly' as const, justification: 'Cambió la auditoría.' };

    it('puts the body to the control and unwraps the detail it answers with', () => {
      let got: unknown;
      service.setPeriodicity('c1', body).subscribe((d) => (got = d));
      const req = http.expectOne((r) => r.url.endsWith('/controls/c1/periodicity'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      expect(req.request.params.has('view')).toBeFalse();
      req.flush({ statusCode: 200, message: 'ok', data: { id: 'c1' } });
      expect(got).toEqual({ id: 'c1' });
    });

    it('sends null to go back to the suggested one, and the view only when asked', () => {
      service.setPeriodicity('c1', { periodicity: null, justification: 'Volver.' }, 'technical').subscribe();
      const req = http.expectOne((r) => r.url.endsWith('/controls/c1/periodicity'));
      expect(req.request.body).toEqual({ periodicity: null, justification: 'Volver.' });
      expect(req.request.params.get('view')).toBe('technical');
      req.flush({ statusCode: 200, message: 'ok', data: { id: 'c1' } });
    });

    it('lets the 422 of a field and the 409 of a retired control reach the caller untouched', () => {
      const failures: HttpErrorResponse[] = [];
      service.setPeriodicity('c1', body).subscribe({ error: (e: HttpErrorResponse) => failures.push(e) });
      http.expectOne((r) => r.url.endsWith('/controls/c1/periodicity')).flush({ message: 'Justificación obligatoria.' }, { status: 422, statusText: 'Unprocessable Entity' });
      service.setPeriodicity('c1', body).subscribe({ error: (e: HttpErrorResponse) => failures.push(e) });
      http.expectOne((r) => r.url.endsWith('/controls/c1/periodicity')).flush({ message: 'Este control ya fue dado de baja.' }, { status: 409, statusText: 'Conflict' });
      expect(failures.map((e) => e.status)).toEqual([422, 409]);
      expect(failures[1].error.message).toBe('Este control ya fue dado de baja.');
    });
  });

  it('posts the approval decision with the view and the result of a manual test without it', () => {
    service.decide('c1', { decision: 'return', reason: 'Falta la firma', returned_submission_ids: ['s1'] }, 'technical').subscribe();
    const approval = http.expectOne((r) => r.url.endsWith('/controls/c1/approval'));
    expect(approval.request.method).toBe('POST');
    expect(approval.request.params.get('view')).toBe('technical');
    expect(approval.request.body).toEqual({ decision: 'return', reason: 'Falta la firma', returned_submission_ids: ['s1'] });
    approval.flush({ statusCode: 200, message: 'control.approval', data: { id: 'c1' } });

    service.registerResult('c1', 't1', { result: 'observation', note: 'Una firma falta' }).subscribe();
    const result = http.expectOne((r) => r.url.endsWith('/controls/c1/tests/t1/result'));
    expect(result.request.method).toBe('POST');
    expect(result.request.body).toEqual({ result: 'observation', note: 'Una firma falta' });
    result.flush({ statusCode: 201, message: 'manual_test_result.register', data: { id: 'r1', management_state: 'in_progress' } });
  });
});
