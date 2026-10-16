import { provideHttpClient } from '@angular/common/http';
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

  it('uploads the file as multipart in the "file" field of the requirement', () => {
    const file = new File(['contenido'], 'politica.pdf', { type: 'application/pdf' });
    service.upload('e1', file).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/evidence-requirements/e1/submissions'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    const sent = (req.request.body as FormData).get('file') as File;
    expect(sent.name).toBe('politica.pdf');
    expect(sent.size).toBe(file.size);
    req.flush({ statusCode: 201, message: '', data: { id: 's1', version: 1 } });
  });

  it('asks for a temporary download link of a delivered evidence', () => {
    let url = '';
    service.download('s1').subscribe((r) => (url = r.url));
    http.expectOne((r) => r.url.endsWith('/evidence-submissions/s1/download')).flush({ statusCode: 200, message: '', data: { url: 'https://storage/x', file_name: 'a.pdf', expires_in: 300 } });
    expect(url).toBe('https://storage/x');
  });
});
