import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { envelope, makeNotification, pageOf } from '@features/notifications/testing/notification-fixtures';
import { NotificationItem } from '@features/notifications/domain/models/notification.models';
import { NotificationPage, NotificationService } from './notification.service';

const api = `${environment.apiUrl}/me`;

describe('NotificationService', () => {
  let service: NotificationService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationService);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('lists with the filters of the contract and maps the page', () => {
    let result: NotificationPage | undefined;
    service.list({ status: 'unread', type: 'window_due_soon', page: 2, pageSize: 10 }).subscribe((r) => (result = r));
    const req = backend.expectOne((r) => r.url === `${api}/notifications`);
    expect(req.request.params.get('status')).toBe('unread');
    expect(req.request.params.get('type')).toBe('window_due_soon');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('10');
    req.flush(pageOf([makeNotification()], 2, 3, 41));
    expect(result?.items.length).toBe(1);
    expect(result?.page).toEqual({ page: 2, pageSize: 25, total: 41, totalPages: 3 });
  });

  it('does not send «status» for «all» nor an empty type', () => {
    service.list({ status: 'all', type: null }).subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/notifications`);
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.params.has('type')).toBeFalse();
    req.flush(pageOf([]));
  });

  it('listAll walks every page of 100', () => {
    let all: NotificationItem[] = [];
    service.listAll({ status: 'unread' }).subscribe((items) => (all = items));
    const first = backend.expectOne((r) => r.url === `${api}/notifications` && r.params.get('page') === '1');
    expect(first.request.params.get('page_size')).toBe('100');
    first.flush(pageOf([makeNotification({ id: 'a' })], 1, 2, 2));
    const second = backend.expectOne((r) => r.url === `${api}/notifications` && r.params.get('page') === '2');
    second.flush(pageOf([makeNotification({ id: 'b' })], 2, 2, 2));
    expect(all.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('reads the counter', () => {
    let count = -1;
    service.unreadCount().subscribe((n) => (count = n));
    backend.expectOne(`${api}/notifications/unread-count`).flush(envelope({ unread_count: 3 }));
    expect(count).toBe(3);
  });

  it('marks one notice read or unread with PATCH', () => {
    service.setRead('n-1', true).subscribe();
    const req = backend.expectOne(`${api}/notifications/n-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ is_read: true });
    req.flush(envelope(makeNotification({ is_read: true })));
  });

  it('marks all read up to the newest one the person saw', () => {
    let updated = 0;
    service.markAllRead('2026-12-16T12:00:05Z').subscribe((n) => (updated = n));
    const req = backend.expectOne(`${api}/notifications/read-all`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ up_to: '2026-12-16T12:00:05Z' });
    req.flush(envelope({ updated_count: 3 }));
    expect(updated).toBe(3);
  });

  it('reads and changes the preferences', () => {
    service.preferences().subscribe();
    backend.expectOne(`${api}/notification-preferences`).flush(envelope({ is_email_digest_enabled: true, email_digest_time_utc: '12:00' }));
    service.setDigest(false).subscribe();
    const req = backend.expectOne(`${api}/notification-preferences`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ is_email_digest_enabled: false });
    req.flush(envelope({ is_email_digest_enabled: false, email_digest_time_utc: '12:00' }));
  });

  it('asks for the notice types once', () => {
    const seen: string[][] = [];
    service.typeOptions().subscribe((o) => seen.push(o.map((x) => x.label)));
    service.typeOptions().subscribe((o) => seen.push(o.map((x) => x.label)));
    backend.expectOne(`${environment.apiUrl}/catalogs/notification_type`).flush(envelope({ items: [{ value: 'window_due_soon', label: 'Ventana por vencer' }] }));
    expect(seen).toEqual([['Ventana por vencer'], ['Ventana por vencer']]);
  });
});
