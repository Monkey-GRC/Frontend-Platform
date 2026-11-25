import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { FakeEventSource, provideFakeEventSource } from '@features/notifications/testing/fake-event-source';
import { envelope, makeNotification } from '@features/notifications/testing/notification-fixtures';
import {
  NotificationStreamService,
  STREAM_FALLBACK_POLL_MS,
  STREAM_RETRY_MAX_MS,
  reconnectDelay,
} from './notification-stream.service';

const COUNT_URL = `${environment.apiUrl}/me/notifications/unread-count`;
const STREAM_URL = `${environment.apiUrl}/me/notifications/stream`;

describe('NotificationStreamService', () => {
  let stream: NotificationStreamService;
  let backend: HttpTestingController;
  let session: SessionService;

  const current = () => FakeEventSource.all[FakeEventSource.all.length - 1];

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideFakeEventSource()] });
    session = TestBed.inject(SessionService);
    session.set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
    stream = TestBed.inject(NotificationStreamService);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    stream.stop();
    backend.verify();
    jasmine.clock().uninstall();
  });

  function startAndConnect(count = 3): void {
    stream.start();
    backend.expectOne(COUNT_URL).flush(envelope({ unread_count: count }));
    current().emit('ready', { unread_count: count });
  }

  it('backs off 1 s, 2 s, 4 s… up to 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 16000, STREAM_RETRY_MAX_MS, STREAM_RETRY_MAX_MS, STREAM_RETRY_MAX_MS]);
  });

  it('opens one stream with the cookie URL of the contract and reads the first counter', () => {
    stream.start();
    stream.start();
    expect(FakeEventSource.all.length).toBe(1);
    expect(current().url).toBe(STREAM_URL);
    backend.expectOne(COUNT_URL).flush(envelope({ unread_count: 2 }));
    expect(stream.unreadCount()).toBe(2);
    expect(stream.connected()).toBeFalse();
    current().emit('ready', { unread_count: 5 });
    expect(stream.connected()).toBeTrue();
    expect(stream.unreadCount()).toBe(5);
  });

  it('takes the counter of a new notice and of a change made in another tab, and reports both as changes', () => {
    startAndConnect(3);
    const before = stream.changes();
    current().emit('notification', { unread_count: 4, notification: makeNotification() });
    expect(stream.unreadCount()).toBe(4);
    expect(stream.changes()).toBe(before + 1);
    current().emit('unread_count', { unread_count: 1 });
    expect(stream.unreadCount()).toBe(1);
    expect(stream.changes()).toBe(before + 2);
  });

  it('ignores a ping and a message it cannot read', () => {
    startAndConnect(3);
    current().emit('ping', {});
    const bad = new MessageEvent('notification', { data: '{not json' });
    expect(() => current().listeners.get('notification')?.forEach((l) => l(bad))).not.toThrow();
    expect(stream.unreadCount()).toBe(3);
  });

  it('when the stream drops it closes it, asks the counter every 60 s and reconnects after the counter answers (which renews the session)', () => {
    startAndConnect(3);
    const dropped = current();
    dropped.emit('error');
    expect(dropped.closed).toBeTrue();
    expect(stream.connected()).toBeFalse();

    jasmine.clock().tick(STREAM_FALLBACK_POLL_MS - 1);
    // El primer intento (1 s) pide el contador antes de abrir de nuevo.
    const retry = backend.expectOne(COUNT_URL);
    expect(FakeEventSource.all.length).toBe(1);
    retry.flush(envelope({ unread_count: 7 }));
    expect(FakeEventSource.all.length).toBe(2);
    expect(stream.unreadCount()).toBe(7);
    current().emit('ready', { unread_count: 7 });
    expect(stream.connected()).toBeTrue();
    // Conectado otra vez: ya no se consulta cada 60 s.
    jasmine.clock().tick(STREAM_FALLBACK_POLL_MS * 2);
    backend.expectNone(COUNT_URL);
  });

  it('polls the counter every 60 s while the stream is down and keeps retrying with a longer wait', () => {
    startAndConnect(3);
    current().emit('error');
    jasmine.clock().tick(1000);
    backend.expectOne(COUNT_URL).error(new ProgressEvent('error'), { status: 0 });
    // La espera pasa a 2 s; el contador de respaldo sale a los 60 s.
    jasmine.clock().tick(1999);
    backend.expectNone(COUNT_URL);
    jasmine.clock().tick(1);
    backend.expectOne(COUNT_URL).error(new ProgressEvent('error'), { status: 0 });
    jasmine.clock().tick(4000);
    backend.expectOne(COUNT_URL).error(new ProgressEvent('error'), { status: 0 });
    expect(FakeEventSource.all.length).toBe(1);
    jasmine.clock().tick(STREAM_FALLBACK_POLL_MS);
    // Un reintento que sigue esperando respuesta (a los 15 s) y el contador de respaldo (a los 60 s).
    expect(backend.match(COUNT_URL).length).toBe(2);
  });

  it('ignores the answer of a counter request when a newer count arrived live after it left', () => {
    startAndConnect(3);
    stream.refresh();
    const old = backend.expectOne(COUNT_URL);
    current().emit('notification', { unread_count: 9, notification: makeNotification() });
    old.flush(envelope({ unread_count: 4 }));
    expect(stream.unreadCount()).toBe(9);
    stream.refresh();
    backend.expectOne(COUNT_URL).flush(envelope({ unread_count: 2 }));
    expect(stream.unreadCount()).toBe(2);
  });

  it('ignores an event whose unread_count is not a number', () => {
    startAndConnect(3);
    const changes = stream.changes();
    current().emit('unread_count', { unread_count: '7' });
    current().emit('unread_count', {});
    current().emit('notification', { notification: makeNotification() });
    current().emit('unread_count', null);
    expect(stream.unreadCount()).toBe(3);
    expect(stream.changes()).toBe(changes);
  });

  it('closes everything on stop and leaves nothing running', () => {
    startAndConnect(3);
    current().emit('error');
    stream.stop();
    expect(current().closed).toBeTrue();
    expect(stream.unreadCount()).toBe(0);
    jasmine.clock().tick(STREAM_FALLBACK_POLL_MS * 3);
    backend.expectNone(COUNT_URL);
    expect(FakeEventSource.all.length).toBe(1);
  });

  it('closes the stream when the session ends', () => {
    startAndConnect(3);
    const source = current();
    session.clear();
    TestBed.tick();
    expect(source.closed).toBeTrue();
    expect(stream.connected()).toBeFalse();
  });

  it('adjusts the counter at once when a notice is marked and never goes below zero', () => {
    startAndConnect(1);
    stream.adjust(-1);
    expect(stream.unreadCount()).toBe(0);
    stream.adjust(-1);
    expect(stream.unreadCount()).toBe(0);
    stream.adjust(2);
    expect(stream.unreadCount()).toBe(2);
  });
});
