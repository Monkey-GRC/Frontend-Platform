import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FindingService } from './finding.service';

describe('FindingService', () => {
  it('asks for the findings of one test of one control, paginated, and returns the data', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    let total = 0;
    TestBed.inject(FindingService).list('c1', 't1', 2, 10).subscribe((p) => (total = p.total));
    const req = http.expectOne((r) => r.url.endsWith('/controls/c1/tests/t1/findings'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('10');
    req.flush({ statusCode: 200, message: '', data: { test_id: 't1', measured_at: null, items: [], page: 2, page_size: 10, total: 7, total_pages: 1 } });
    expect(total).toBe(7);
    http.verify();
  });
});