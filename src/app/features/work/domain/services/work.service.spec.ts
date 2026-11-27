import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WorkService } from './work.service';

describe('WorkService', () => {
  it('asks for the to_review bucket and maps the page', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    let page: unknown;
    TestBed.inject(WorkService).toReview(2, 25).subscribe((p) => (page = p.page));
    const req = http.expectOne((r) => r.url.endsWith('/me/work'));
    expect(req.request.params.get('bucket')).toBe('to_review');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('25');
    req.flush({ statusCode: 200, message: '', data: { items: [], page: 2, page_size: 25, total: 30, total_pages: 2, progress: null } });
    expect(page).toEqual({ page: 2, pageSize: 25, total: 30, totalPages: 2 });
    http.verify();
  });
});
