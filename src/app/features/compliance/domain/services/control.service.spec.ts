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

  it('reads who owns each dimension of a control, sets or clears the exception, and lists the people to choose from', () => {
    let rows = 0;
    service.responsibles('c1').subscribe((r) => (rows = r.length));
    http.expectOne((r) => r.url.endsWith('/controls/c1/responsibles')).flush({ data: { items: [{ dimension: 'policy' }, { dimension: 'cloud' }] } });
    expect(rows).toBe(2);

    service.setResponsible('c1', 'cloud', null).subscribe();
    const set = http.expectOne((r) => r.url.endsWith('/controls/c1/responsibles/cloud'));
    expect(set.request.method).toBe('PATCH');
    expect(set.request.body).toEqual({ user_id: null });
    set.flush({ data: {} });

    let people: string[] = [];
    service.candidates().subscribe((c) => (people = c.map((x) => x.id)));
    const req = http.expectOne((r) => r.url.endsWith('/users'));
    expect(req.request.params.get('role')).toBe('funcional');
    req.flush({ data: { items: [{ id: 'a', status: 'active' }, { id: 'b', status: 'inactive' }, { id: 'c', status: 'pending' }] } });
    expect(people).toEqual(['a', 'c']); // una cuenta desactivada no recibe trabajo
  });
});