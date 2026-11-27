import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { TechnicalControlService } from './technical-control.service';

const api = environment.apiUrl;

describe('TechnicalControlService · Microsoft 365 (D154)', () => {
  let service: TechnicalControlService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TechnicalControlService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('delivers the application id with PATCH /assets/{id}/connection and nothing else, and unwraps the asset', () => {
    let method: string | undefined;
    service.setClientId('a1', '0b8c3e1a-2d4f-4a6b-8c9d-1e2f3a4b5c6d').subscribe((a) => (method = a.connection_setup?.method));
    const req = http.expectOne(`${api}/assets/a1/connection`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ client_id: '0b8c3e1a-2d4f-4a6b-8c9d-1e2f3a4b5c6d' });
    req.flush({ data: { id: 'a1', connection_setup: { method: 'app_certificate', tenant_id: '3f2a91c4-7b6d-4e0a-9c11-5d8e2f7a0b13', client_id: '0b8c3e1a-2d4f-4a6b-8c9d-1e2f3a4b5c6d', steps: [] } } });
    expect(method).toBe('app_certificate');
  });
});
