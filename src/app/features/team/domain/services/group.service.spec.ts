import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { GroupService } from './group.service';

const url = `${environment.apiUrl}/groups`;

describe('GroupService (D102, D104)', () => {
  let service: GroupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GroupService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists the groups the user can see, ordered by name, and returns only the items', () => {
    let names: string[] = [];
    service.list().subscribe((groups) => (names = groups.map((g) => g.name)));
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('sort')).toBe('name');
    expect(req.request.params.get('page_size')).toBe('100');
    req.flush({ data: { items: [{ id: 'g1', name: 'Responsables', kind: 'responsables' }, { id: 'g2', name: 'Equipo de María', kind: 'team' }], page: 1, page_size: 100, total: 2, total_pages: 1 } });
    expect(names).toEqual(['Responsables', 'Equipo de María']);
  });

  it('answers an empty list when the owner has not created their team yet', () => {
    let count = -1;
    service.list().subscribe((groups) => (count = groups.length));
    http.expectOne((r) => r.url === url).flush({ data: { items: [], page: 1, page_size: 100, total: 0, total_pages: 0 } });
    expect(count).toBe(0);
  });

  it('creates a group of owners (no leader) or the team of an owner (with its leader) and returns the group', () => {
    let created = '';
    service.create({ name: 'Responsables - Servicio IA' }).subscribe((g) => (created = g.id));
    const first = http.expectOne(url);
    expect(first.request.method).toBe('POST');
    expect(first.request.body).toEqual({ name: 'Responsables - Servicio IA' });
    first.flush({ data: { id: 'g1', name: 'Responsables - Servicio IA', kind: 'responsables' } });
    expect(created).toBe('g1');

    service.create({ name: 'Equipo de María', leader_id: 'r1' }).subscribe();
    const second = http.expectOne(url);
    expect(second.request.body).toEqual({ name: 'Equipo de María', leader_id: 'r1' });
    second.flush({ data: { id: 'g2', name: 'Equipo de María', kind: 'team' } });
  });

  it('renames a group with a PATCH to its own address', () => {
    let name = '';
    service.rename('g2', 'Equipo A').subscribe((g) => (name = g.name));
    const req = http.expectOne(`${url}/g2`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Equipo A' });
    req.flush({ data: { id: 'g2', name: 'Equipo A', kind: 'team' } });
    expect(name).toBe('Equipo A');
  });
});
