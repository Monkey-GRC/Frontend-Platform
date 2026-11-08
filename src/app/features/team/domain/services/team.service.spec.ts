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

  it('invites a person and reads whether the invitation email went out (the code never comes back, MD-190)', () => {
    let result: { status?: string; code?: unknown } = {};
    service.invite({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'auditor' }).subscribe((m) => (result = { status: m.invitation.delivery_status, code: (m as unknown as Record<string, unknown>)['activation_code'] }));
    const req = http.expectOne(`${api}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'auditor' });
    req.flush({ data: { id: 'u1', email: 'juan@acme.co', status: 'pending', invitation: { delivery_status: 'sent', expires_at: '2026-11-12T15:04:02Z' } } });
    expect(result).toEqual({ status: 'sent', code: undefined });
  });

  it('resends the invitation and gets only the delivery result back, not the person nor the code', () => {
    let result: unknown;
    service.resendInvitation('u1').subscribe((i) => (result = i));
    const req = http.expectOne(`${api}/users/u1/activation-code`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { invitation: { delivery_status: 'failed', expires_at: '2026-11-12T15:04:02Z' } } });
    expect(result).toEqual({ delivery_status: 'failed', expires_at: '2026-11-12T15:04:02Z' });
  });

  it('asks for a page of the team and sends only the filters that were chosen (the server applies them to every page)', () => {
    service.list().subscribe();
    const first = http.expectOne((r) => r.url === `${api}/users`);
    expect(first.request.params.get('page')).toBe('1');
    expect(first.request.params.get('page_size')).toBe('25');
    for (const key of ['role', 'status', 'group_id', 'is_internal']) expect(first.request.params.has(key)).toBeFalse();
    first.flush({ data: { items: [], page: 1, page_size: 25, total: 0, total_pages: 0 } });

    service.list({ role: 'delegado', status: 'pending', groupId: 'g1', isInternal: false }, 2, 50).subscribe();
    const filtered = http.expectOne((r) => r.url === `${api}/users`);
    expect(filtered.request.params.get('page')).toBe('2');
    expect(filtered.request.params.get('page_size')).toBe('50');
    expect(filtered.request.params.get('role')).toBe('delegado');
    expect(filtered.request.params.get('status')).toBe('pending');
    expect(filtered.request.params.get('group_id')).toBe('g1');
    expect(filtered.request.params.get('is_internal')).toBe('false'); // «externo» es un filtro, no la ausencia de filtro
    filtered.flush({ data: { items: [], page: 2, page_size: 50, total: 0, total_pages: 0 } });
  });

  it('changes a person and resets the second factor', () => {

    service.update('u1', { status: 'inactive' }).subscribe();
    const patch = http.expectOne(`${api}/users/u1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'inactive' });
    patch.flush({ data: {} });

    service.resetMfa('u1').subscribe();
    const del = http.expectOne(`${api}/users/u1/mfa`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
