import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentService } from './document.service';
import { MyDocument } from '../models/document.models';

const envelope = <T>(data: T) => ({ statusCode: 200, message: '', data });
const page = <T>(items: T[], over: Partial<{ page: number; total_pages: number; total: number }> = {}) => ({ items, page: 1, page_size: 100, total: items.length, total_pages: 1, ...over });
const mineItem = (id: string): MyDocument => ({
  document: { id, code: `POL-${id}`, name: 'Política', type: 'policy' },
  version: { id: `v-${id}`, number: 1, approved_at: '2026-11-01' },
  requires_acceptance: true,
  status: 'pending',
  assigned_at: '2026-11-02T10:00:00Z',
  due_at: '2026-11-12T10:00:00Z',
  accepted_at: null,
});

describe('DocumentService (contracts/documentos.md)', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('list', () => {
    it('asks for a page with the search, the type and the publication filter, and maps the page of the backend', () => {
      let result = null as { total: number; totalPages: number; pageSize: number; ids: string[] } | null;
      service.list({ page: 2, pageSize: 25, q: '  política ', type: 'policy', hasCurrentVersion: false }).subscribe((r) => (result = { total: r.page.total, totalPages: r.page.totalPages, pageSize: r.page.pageSize, ids: r.items.map((i) => i.id) }));
      const req = http.expectOne((r) => r.url.endsWith('/documents'));
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('page_size')).toBe('25');
      expect(req.request.params.get('q')).toBe('política');
      expect(req.request.params.get('type')).toBe('policy');
      expect(req.request.params.get('has_current_version')).toBe('false');
      req.flush(envelope({ items: [{ id: 'd1' }], page: 2, page_size: 25, total: 31, total_pages: 2 }));
      expect(result).toEqual({ total: 31, totalPages: 2, pageSize: 25, ids: ['d1'] });
    });

    it('does not send the filters that are empty', () => {
      service.list({ page: 1, pageSize: 10, q: '   ', type: null, hasCurrentVersion: null }).subscribe();
      const req = http.expectOne((r) => r.url.endsWith('/documents'));
      expect(req.request.params.keys().sort()).toEqual(['page', 'page_size']);
      req.flush(envelope(page([])));
    });
  });

  it('reads the detail of a document', () => {
    let name = '';
    service.get('d1').subscribe((d) => (name = d.name));
    const req = http.expectOne((r) => r.url.endsWith('/documents/d1'));
    expect(req.request.method).toBe('GET');
    req.flush(envelope({ id: 'd1', name: 'Política de accesos', versions: [], assignees: [] }));
    expect(name).toBe('Política de accesos');
  });

  describe('publishVersion', () => {
    it('sends the file, the approval date, the approvers as a JSON list and the note, as multipart', () => {
      const file = new File(['contenido'], 'politica.pdf', { type: 'application/pdf' });
      service.publishVersion('d1', { file, approved_at: '2026-11-20', approvers: [{ name: 'Ana Ruiz', role_label: 'Gerente' }], note: ' Acta 12 ' }).subscribe();
      const req = http.expectOne((r) => r.url.endsWith('/documents/d1/versions'));
      expect(req.request.method).toBe('POST');
      const body = req.request.body as FormData;
      expect(body instanceof FormData).toBeTrue();
      expect((body.get('file') as File).name).toBe('politica.pdf');
      expect(body.get('approved_at')).toBe('2026-11-20');
      expect(JSON.parse(body.get('approvers') as string)).toEqual([{ name: 'Ana Ruiz', role_label: 'Gerente' }]);
      expect(body.get('note')).toBe('Acta 12');
      req.flush(envelope({ id: 'v2', number: 2 }));
    });

    it('leaves the note out when it is empty', () => {
      const file = new File(['x'], 'a.pdf');
      service.publishVersion('d1', { file, approved_at: '2026-11-20', approvers: [{ name: 'Ana', role_label: 'CEO' }], note: '  ' }).subscribe();
      const body = http.expectOne((r) => r.url.endsWith('/documents/d1/versions')).request.body as FormData;
      expect(body.has('note')).toBeFalse();
    });
  });

  it('asks for the signed link of a version with the disposition', () => {
    let url = '';
    service.fileLink('d1', 'v2', 'inline').subscribe((l) => (url = l.url));
    const req = http.expectOne((r) => r.url.endsWith('/documents/d1/versions/v2/file'));
    expect(req.request.params.get('disposition')).toBe('inline');
    req.flush(envelope({ url: 'https://files.example/x?sig=1', file_name: 'a.pdf', file_type: 'application/pdf', disposition: 'inline', expires_in: 300 }));
    expect(url).toBe('https://files.example/x?sig=1');
  });

  it('assigns the document to the people in one batch and answers how many are new', () => {
    let added = -1;
    service.assign('d1', ['u1', 'u2']).subscribe((n) => (added = n));
    const req = http.expectOne((r) => r.url.endsWith('/documents/d1/assignments'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ user_ids: ['u1', 'u2'] });
    req.flush(envelope({ added: 1 }));
    expect(added).toBe(1);
  });

  describe('mine', () => {
    it('walks the pages of 100 until it has everything the person was assigned', () => {
      let ids: string[] = [];
      service.mine().subscribe((items) => (ids = items.map((i) => i.document.id)));
      const first = http.expectOne((r) => r.url.endsWith('/me/documents') && r.params.get('page') === '1');
      expect(first.request.params.get('page_size')).toBe('100');
      first.flush(envelope(page([mineItem('a')], { total_pages: 2, total: 2 })));
      const second = http.expectOne((r) => r.url.endsWith('/me/documents') && r.params.get('page') === '2');
      second.flush(envelope({ ...page([mineItem('b')], { total_pages: 2, total: 2 }), page: 2 }));
      expect(ids).toEqual(['a', 'b']);
    });

    it('answers an empty list when nothing was assigned', () => {
      let items = null as MyDocument[] | null;
      service.mine().subscribe((r) => (items = r));
      http.expectOne((r) => r.url.endsWith('/me/documents')).flush(envelope(page([], { total_pages: 0 })));
      expect(items).toEqual([]);
    });
  });

  it('accepts with the version the person saw', () => {
    service.accept('d1', 'v2').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/documents/d1/acceptance'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ version_id: 'v2' });
    req.flush(envelope({ id: 'a1', document_id: 'd1', version: { id: 'v2', number: 2 }, accepted_at: '2026-11-24T10:00:00Z', integrity_hash: 'abc' }));
  });

  it('asks the catalog of a document enum once per language, and keeps its labels', () => {
    const labels: string[][] = [];
    service.catalog('document_type').subscribe((o) => labels.push(o.map((x) => x.label)));
    service.catalog('document_type').subscribe((o) => labels.push(o.map((x) => x.label)));
    http.expectOne((r) => r.url.endsWith('/catalogs/document_type')).flush(envelope({ items: [{ value: 'policy', label: 'Política' }] }));
    expect(labels).toEqual([['Política'], ['Política']]);
  });
});
