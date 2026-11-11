import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TeamMember } from '@shared/domain/models/team.models';
import { HomeTeamLoad } from '../models/team.models';
import { HomeTeamService, MAX_PAGES } from './team-overview.service';

const member = (id: string, role: TeamMember['role'] = 'delegado'): TeamMember => ({ id, email: `${id}@x.com`, name: 'A', last_name: 'B', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-01-01T00:00:00Z' });
const envelope = (page: number, totalPages: number, items: TeamMember[]) => ({ statusCode: 200, message: 'ok', data: { items, page, page_size: 100, total: items.length, total_pages: totalPages } });

describe('HomeTeamService', () => {
  let service: HomeTeamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HomeTeamService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const page = (n: number) => (r: { url: string; params: { get(k: string): string | null } }) => r.url.endsWith('/users') && r.params.get('page') === String(n) && r.params.get('page_size') === '100';

  it('asks for one page of 100 and stops when there is only one', () => {
    let got: HomeTeamLoad | undefined;
    service.loadAll().subscribe((m) => (got = m));
    http.expectOne(page(1)).flush(envelope(1, 1, [member('a'), member('b', 'auditor')]));
    expect(got!.members.map((m) => m.role)).toEqual(['delegado', 'auditor']);
    expect(got!.partial).toBeFalse();
  });

  it('keeps asking until the last page and joins them in order', () => {
    let got: HomeTeamLoad | undefined;
    service.loadAll().subscribe((m) => (got = m));
    http.expectOne(page(1)).flush(envelope(1, 2, [member('a')]));
    http.expectOne(page(2)).flush(envelope(2, 2, [member('b', 'responsable')]));
    expect(got!.members.map((m) => m.role)).toEqual(['delegado', 'responsable']);
    expect(got!.partial).toBeFalse();
  });

  it('maps the team member to the minimal model of the home, without ids or emails', () => {
    let got: HomeTeamLoad | undefined;
    service.loadAll().subscribe((m) => (got = m));
    http.expectOne(page(1)).flush(envelope(1, 1, [{ ...member('a'), is_mfa_enabled: false, last_login_at: '2026-01-02T00:00:00Z', status: 'pending' }]));
    expect(got!.members).toEqual([{ role: 'delegado', status: 'pending', mfaEnabled: false, lastLoginAt: '2026-01-02T00:00:00Z' }]);
  });

  it('stops at the page limit and says the summary is partial instead of counting wrong in silence', () => {
    let got: HomeTeamLoad | undefined;
    service.loadAll().subscribe((m) => (got = m));
    for (let n = 1; n <= MAX_PAGES; n++) http.expectOne(page(n)).flush(envelope(n, MAX_PAGES + 3, [member('p' + n)]));
    http.expectNone(page(MAX_PAGES + 1));
    expect(got!.members.length).toBe(MAX_PAGES);
    expect(got!.partial).toBeTrue();
  });

  it('fails when a page fails', () => {
    let failed = false;
    service.loadAll().subscribe({ error: () => (failed = true) });
    http.expectOne(page(1)).flush({}, { status: 500, statusText: 'x' });
    expect(failed).toBeTrue();
  });
});
