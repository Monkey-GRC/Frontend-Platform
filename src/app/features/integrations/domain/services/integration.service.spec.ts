import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment';
import { IntegrationService } from './integration.service';

describe('IntegrationService', () => {
  let http: HttpTestingController;
  let service: IntegrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(IntegrationService);
  });

  it('reads the company integrations', () => {
    let out: unknown;
    service.list().subscribe((r) => (out = r));
    const req = http.expectOne(`${environment.apiUrl}/integrations`);
    expect(req.request.method).toBe('GET');
    req.flush({ statusCode: 200, message: 'integration.list', data: { items: [{ code: 'aws' }] } });
    expect(out).toEqual([{ code: 'aws' } as never]);
  });

  it('reads the catalog', () => {
    let out: unknown;
    service.catalog().subscribe((r) => (out = r));
    http.expectOne(`${environment.apiUrl}/integrations/catalog`).flush({ statusCode: 200, message: 'integration.catalog', data: { items: [{ code: 'jira' }] } });
    expect(out).toEqual([{ code: 'jira' } as never]);
  });

  it('reads the detail of one integration', () => {
    let out: unknown;
    service.getDetail('aws').subscribe((r) => (out = r));
    const req = http.expectOne(`${environment.apiUrl}/integrations/aws`);
    expect(req.request.method).toBe('GET');
    req.flush({ statusCode: 200, message: 'integration.detail', data: { code: 'aws' } });
    expect(out).toEqual({ code: 'aws' } as never);
  });
});
