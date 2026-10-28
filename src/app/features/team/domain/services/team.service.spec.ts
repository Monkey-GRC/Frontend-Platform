import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { TeamService } from './team.service';

const api = environment.apiUrl;

describe('TeamService (D96)', () => {
  let service: TeamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('invites a person and keeps the activation code that comes back once', () => {
    let code = '';
    service.invite({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'funcional', dimensions: ['server'] }).subscribe((m) => (code = m.activation_code.code));
    const req = http.expectOne(`${api}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'funcional', dimensions: ['server'] });
    req.flush({ data: { id: 'u1', email: 'juan@acme.co', activation_code: { code: 'MNK-AAAA-BBBB-CCCC', status: 'pending', expires_at: '2026-11-04T00:00:00Z' } } });
    expect(code).toBe('MNK-AAAA-BBBB-CCCC');
  });

  it('lists the team, changes a person, issues a new code and resets the second factor', () => {
    service.list().subscribe();
    const list = http.expectOne((r) => r.url === `${api}/users`);
    expect(list.request.params.get('page_size')).toBe('100');
    list.flush({ data: { items: [], page: 1, page_size: 100, total: 0, total_pages: 0 } });

    service.update('u1', { status: 'inactive' }).subscribe();
    const patch = http.expectOne(`${api}/users/u1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'inactive' });
    patch.flush({ data: {} });

    service.reissueCode('u1').subscribe();
    expect(http.expectOne(`${api}/users/u1/activation-code`).request.method).toBe('POST');

    service.resetMfa('u1').subscribe();
    const del = http.expectOne(`${api}/users/u1/mfa`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('reads the owners of a service and sets or clears the owner of a dimension', () => {
    let rows = 0;
    service.dimensionOwners('s1').subscribe((r) => (rows = r.length));
    http.expectOne(`${api}/services/s1/dimension-owners`).flush({ data: { items: [{ dimension: 'server' }, { dimension: 'cloud' }] } });
    expect(rows).toBe(2);

    service.setDimensionOwner('s1', 'server', 'u1').subscribe();
    const set = http.expectOne(`${api}/services/s1/dimension-owners/server`);
    expect(set.request.method).toBe('PATCH');
    expect(set.request.body).toEqual({ user_id: 'u1' });
    set.flush({ data: {} });

    service.setDimensionOwner('s1', 'server', null).subscribe();
    const clear = http.expectOne(`${api}/services/s1/dimension-owners/server`);
    expect(clear.request.body).toEqual({ user_id: null });
    clear.flush({ data: {} });
  });
});
