import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ControlManagementService } from './control-management.service';

describe('ControlManagementService', () => {
  let service: ControlManagementService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ControlManagementService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const post = (suffix: string, body: unknown, data: unknown = {}) => {
    const req = http.expectOne((r) => r.url.endsWith(suffix));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ statusCode: 200, message: '', data });
  };

  it('proposes and decides a level', () => {
    service.proposeLevel('c1', { proposed_level: 'weak', justification: 'x' }).subscribe();
    post('/controls/c1/level-overrides', { proposed_level: 'weak', justification: 'x' });
    service.decideLevel('o1', { decision: 'reject', reason: 'no' }).subscribe();
    post('/level-overrides/o1/decision', { decision: 'reject', reason: 'no' });
  });

  it('registers and decides a remediation plan', () => {
    const body = { test_id: 't1', what: 'Firmar', owner_id: 'u1', due_date: '2026-12-31' };
    service.registerPlan('c1', body).subscribe();
    post('/controls/c1/remediation-plans', body);
    service.decidePlan('p1', { decision: 'approve' }).subscribe();
    post('/remediation-plans/p1/decision', { decision: 'approve' });
  });

  it('requests, decides and reverts a not-applicable', () => {
    service.requestNotApplicable('c1', 'r1', 'No aplica').subscribe();
    post('/controls/c1/requirements/r1/not-applicable-requests', { reason: 'No aplica' });
    service.decideNotApplicable('n1', { decision: 'approve' }).subscribe();
    post('/not-applicable-requests/n1/decision', { decision: 'approve' });
    service.revertNotApplicable('c1', 'r1', 'Ahora aplica').subscribe();
    post('/controls/c1/requirements/r1/not-applicable/revert', { reason: 'Ahora aplica' });
  });

  it('registers an occurrence, declares none and lists the occurrences of a requirement', () => {
    service.registerOccurrence('c1', 'r1', { occurred_on: '2026-11-20', description: 'Alta' }).subscribe();
    post('/controls/c1/requirements/r1/occurrences', { occurred_on: '2026-11-20', description: 'Alta' });
    service.declareNoOccurrences('c1', 'r1').subscribe();
    post('/controls/c1/requirements/r1/no-occurrence-declarations', {});
    let items: unknown[] = [];
    service.listOccurrences('c1', 'r1').subscribe((i) => (items = i));
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/requirements/r1/occurrences'));
    expect(req.request.method).toBe('GET');
    req.flush({ statusCode: 200, message: '', data: { items: [{ id: 'oc1' }], page: 1, page_size: 100, total: 1, total_pages: 1 } });
    expect(items.length).toBe(1);
  });

  it('asks for the history newest first, a page at a time, and maps the page', () => {
    let page: unknown;
    service.history('c1', 2, 10).subscribe((p) => (page = p.page));
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/management-history'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('-at');
    req.flush({ statusCode: 200, message: '', data: { items: [], page: 2, page_size: 10, total: 12, total_pages: 2 } });
    expect(page).toEqual({ page: 2, pageSize: 10, total: 12, totalPages: 2 });
  });

  it('lists the directory of the company as it comes, with no filter by role', () => {
    let ids: string[] = [];
    service.assignees().subscribe((p) => (ids = p.map((u) => u.id)));
    const req = http.expectOne((r) => r.url.endsWith('/users/directory'));
    req.flush({ statusCode: 200, message: '', data: { items: [{ id: 'a', role: 'admin_empresa' }, { id: 'b', role: 'auditor' }, { id: 'c', role: 'delegado' }] } });
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
