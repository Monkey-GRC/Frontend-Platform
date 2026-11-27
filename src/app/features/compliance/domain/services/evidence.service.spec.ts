import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EvidenceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the evidence of the control, with the technical view only when asked', () => {
    let items: unknown[] = [];
    service.list('c1').subscribe((r) => (items = r));
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/evidence'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('view')).toBeFalse();
    req.flush({ statusCode: 200, message: '', data: { items: [{ id: 'e1' }] } });
    expect(items).toEqual([{ id: 'e1' }]);

    service.list('c1', 'technical').subscribe();
    http.expectOne((r) => r.url.endsWith('/controls/c1/evidence') && r.params.get('view') === 'technical').flush({ statusCode: 200, message: '', data: { items: [] } });
  });

  it('asks for the evidence of the whole service in one request, with the technical view only when asked', () => {
    let items: unknown[] = [];
    service.listByService('s1').subscribe((r) => (items = r));
    const req = http.expectOne((r) => r.url.endsWith('/services/s1/evidence'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('view')).toBeFalse();
    req.flush({ statusCode: 200, message: '', data: { items: [{ id: 'e1', control_id: 'c1' }] } });
    expect(items).toEqual([{ id: 'e1', control_id: 'c1' }]);

    service.listByService('s1', 'technical').subscribe();
    http.expectOne((r) => r.url.endsWith('/services/s1/evidence') && r.params.get('view') === 'technical').flush({ statusCode: 200, message: '', data: { items: [] } });
  });

  it('uploads the file as multipart in the "file" field of the requirement', () => {
    const file = new File(['contenido'], 'politica.pdf', { type: 'application/pdf' });
    const events: unknown[] = [];
    service.upload('e1', file).subscribe((e) => events.push(e));
    const req = http.expectOne((r) => r.url.endsWith('/evidence-requirements/e1/submissions'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    const sent = (req.request.body as FormData).get('file') as File;
    expect(sent.name).toBe('politica.pdf');
    expect(sent.size).toBe(file.size);
    expect(req.request.reportProgress).toBeTrue();
    req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 20 });
    req.flush({ statusCode: 201, message: '', data: { id: 's1', version: 1 } });
    expect(events).toEqual([{ kind: 'progress', percent: 25 }, { kind: 'done', submission: { id: 's1', version: 1 } as never }]);
  });

  it('asks for a temporary download link of a delivered evidence', () => {
    let url = '';
    service.download('s1').subscribe((r) => (url = r.url));
    const req = http.expectOne((r) => r.url.endsWith('/evidence-submissions/s1/download'));
    expect(req.request.params.get('disposition')).toBe('attachment'); // por defecto se baja
    req.flush({ statusCode: 200, message: '', data: { url: 'https://storage/x', file_name: 'a.pdf', expires_in: 300 } });
    expect(url).toBe('https://storage/x');
  });

  it('asks for the link to SHOW the file (inline) when it is for the viewer', () => {
    service.download('s1', 'inline').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/evidence-submissions/s1/download'));
    expect(req.request.params.get('disposition')).toBe('inline');
    req.flush({ statusCode: 200, message: '', data: { url: 'https://storage/x', file_name: 'a.pdf', file_type: 'application/pdf', disposition: 'inline', expires_in: 300 } });
  });

  it('reads the evidence of one test with the controls it also applies to, and tolerates missing lists', () => {
    let result: unknown;
    service.listForTest('c1', 't9').subscribe((r) => (result = r));
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/tests/t9/evidence'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('view')).toBeFalse();
    req.flush({ statusCode: 200, message: '', data: { test_id: 't9', shared_with: [{ id: 'k2', code: 'IAC-12' }], items: [{ id: 'e1' }] } });
    expect(result).toEqual({ test_id: 't9', shared_with: [{ id: 'k2', code: 'IAC-12' }], items: [{ id: 'e1' }] });

    service.listForTest('c1', 't9', 'technical').subscribe((r) => (result = r));
    http.expectOne((r) => r.url.endsWith('/controls/c1/tests/t9/evidence') && r.params.get('view') === 'technical').flush({ statusCode: 200, message: '', data: {} });
    expect(result).toEqual({ test_id: 't9', shared_with: [], items: [] });
  });
});
