import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { AssignmentService } from './assignment.service';

const url = `${environment.apiUrl}/assignments`;

describe('AssignmentService', () => {
  let service: AssignmentService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AssignmentService);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('asks for the page with the filters of the contract and leaves the empty ones out', () => {
    let result: unknown;
    service.list({ serviceId: 's-1', assignment: 'unassigned', status: 'effective', q: '  CC6.1 ', page: 2, pageSize: 50, ownerId: null, executorId: '' }).subscribe((r) => (result = r));
    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['assignment', 'page', 'page_size', 'q', 'service_id', 'status']);
    expect(req.request.params.get('q')).toBe('CC6.1');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ statusCode: 200, message: 'assignment.list', data: { items: [{ client_control_id: 'c-1' }], page: 2, page_size: 50, total: 51, total_pages: 2 } });
    expect(result).toEqual({ items: [{ client_control_id: 'c-1' }], page: { page: 2, pageSize: 50, total: 51, totalPages: 2 } });
  });

  it('asks for the first page of 25 by default', () => {
    service.list().subscribe();
    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('25');
    req.flush({ statusCode: 200, message: 'ok', data: { items: [], page: 1, page_size: 25, total: 0, total_pages: 0 } });
  });

  it('sets the owner of several controls, or leaves them unassigned with null', () => {
    let updated = -1;
    service.setOwner(['c-1', 'c-2'], 'u-1').subscribe((r) => (updated = r.updated));
    const req = backend.expectOne(`${url}/owner`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ client_control_ids: ['c-1', 'c-2'], owner_id: 'u-1' });
    req.flush({ statusCode: 200, message: 'assignment.owner_updated', data: { updated: 2 } });
    expect(updated).toBe(2);

    service.setOwner(['c-1'], null).subscribe();
    const clear = backend.expectOne(`${url}/owner`);
    expect(clear.request.body).toEqual({ client_control_ids: ['c-1'], owner_id: null });
    clear.flush({ statusCode: 200, message: 'ok', data: { updated: 1 } });
  });

  it('sets or removes the executor', () => {
    service.setExecutor(['c-1'], 'd-1').subscribe();
    const req = backend.expectOne(`${url}/executor`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ client_control_ids: ['c-1'], executor_id: 'd-1' });
    req.flush({ statusCode: 200, message: 'ok', data: { updated: 1 } });

    service.setExecutor(['c-1'], null).subscribe();
    const clear = backend.expectOne(`${url}/executor`);
    expect(clear.request.body).toEqual({ client_control_ids: ['c-1'], executor_id: null });
    clear.flush({ statusCode: 200, message: 'ok', data: { updated: 0 } });
  });
});
