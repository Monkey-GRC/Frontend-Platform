import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { FakeEventSource, provideFakeEventSource } from '@features/notifications/testing/fake-event-source';
import { envelope, makeNotification, pageOf } from '@features/notifications/testing/notification-fixtures';
import { LIVE_RELOAD_DELAY_MS, NotificationBell, PANEL_SIZE } from './notification-bell';

const api = `${environment.apiUrl}/me/notifications`;

describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let backend: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => Array.from(el().querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));

  const unread = makeNotification({ id: 'n-1', created_at: '2026-12-16T12:00:05Z' });
  const read = makeNotification({ id: 'n-2', is_read: true, read_at: '2026-12-16T13:00:00Z', created_at: '2026-12-15T12:00:00Z', title: 'IAC-03 · Evidencia validada', service: null });

  function setup(count: number) {
    TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), provideFakeEventSource()],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'responsable' }, { id: 'c', name: 'ACME' });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    backend.expectOne(`${api}/unread-count`).flush(envelope({ unread_count: count }));
    fixture.detectChanges();
  }

  function openPanel(items = [unread, read], firstTime = true): void {
    q('bell-trigger')!.click();
    fixture.detectChanges();
    if (firstTime) expect(q('bell-loading')).not.toBeNull();
    backend.expectOne((r) => r.url === api && r.params.get('page_size') === String(PANEL_SIZE) && !r.params.has('status')).flush(pageOf(items));
    fixture.detectChanges();
  }

  afterEach(() => {
    backend.match(`${environment.apiUrl}/catalogs/notification_type`).forEach((r) => r.flush(envelope({ items: [] })));
    backend.verify();
  });

  it('opens the stream when it appears and closes it when it disappears (nothing left connected)', () => {
    setup(0);
    expect(FakeEventSource.last.url).toBe(`${api}/stream`);
    expect(FakeEventSource.last.closed).toBeFalse();
    const source = FakeEventSource.last;
    fixture.destroy();
    expect(source.closed).toBeTrue();
  });

  it('says how many are unread, to the eye and to a screen reader, and hides the number at zero', () => {
    setup(0);
    expect(q('bell-count')).toBeNull();
    expect(q('bell-trigger')!.getAttribute('aria-label')).toBe('NOTIFICATIONS.BELL.LABEL_NONE');
    expect(q('bell-trigger')!.getAttribute('title')).toBe('NOTIFICATIONS.BELL.TITLE');
    FakeEventSource.last.emit('ready', { unread_count: 1 });
    fixture.detectChanges();
    expect(q('bell-count')!.textContent!.trim()).toBe('1');
    expect(q('bell-trigger')!.getAttribute('aria-label')).toBe('NOTIFICATIONS.BELL.LABEL_ONE');
    FakeEventSource.last.emit('ready', { unread_count: 4 });
    fixture.detectChanges();
    expect(q('bell-trigger')!.getAttribute('aria-label')).toBe('NOTIFICATIONS.BELL.LABEL_MANY');
    FakeEventSource.last.emit('ready', { unread_count: 140 });
    fixture.detectChanges();
    expect(q('bell-count')!.textContent!.trim()).toBe('99+');
  });

  it('opens a panel with the latest notices: loading first, then the code in the title, the service and the unread ones marked', () => {
    setup(1);
    openPanel();
    const items = all('bell-item');
    expect(items.length).toBe(2);
    expect(items[0].getAttribute('data-unread')).toBe('true');
    expect(items[1].getAttribute('data-unread')).toBe('false');
    expect(items[0].textContent).toContain('Plataforma de pagos');
    // La tarjeta: el título sin el código (va en el pie, con sus requisitos), el resumen corto y no el párrafo de «Qué ocurrió».
    expect(items[0].querySelector('[data-testid="notice-title"]')!.textContent).toContain('La ventana trimestral cierra');
    expect(items[0].querySelector('[data-testid="notice-title"]')!.textContent).not.toContain('IAC-12');
    expect(items[0].querySelector('[data-testid="notice-summary"]')!.textContent).toContain('no tiene evidencia válida');
    expect(Array.from(items[0].querySelectorAll('[data-testid="notice-codes"] app-tag')).map((t) => t.textContent!.trim())).toEqual(['IAC-12', 'CC6.1', 'CC6.2']);
    expect(items[0].querySelector('[data-testid="notice-open"]')!.textContent).toContain('NOTIFICATIONS.CARD.VIEW_DETAILS');
    expect(items[0].querySelector('[data-testid="bell-item-brief"]')).toBeNull();
    expect(q('bell-group-count')!.textContent!.trim()).toBe('2');
    expect(q('bell-footer-all')!.getAttribute('href')).toBe('/notificaciones');
    expect(q('bell-see-all')).toBeNull();
    expect(q('bell-trigger')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('the footer link is the only way to the notifications page: it goes there in the same tab and closes the panel', async () => {
    setup(1);
    openPanel();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    q('bell-footer-all')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalled();
    expect(q('bell-panel')).toBeNull();
  });

  it('«Ver detalles» opens the detail over the page without navigating, and the action inside it goes to the control', () => {
    setup(1);
    openPanel();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl');
    const card = all('notice-open')[0];
    expect(card.getAttribute('href')).toBeNull();
    card.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/n-1`).flush(envelope({ ...unread, is_read: true }));
    backend.expectOne(`${environment.apiUrl}/catalogs/notification_type`).flush(envelope({ items: [] }));
    fixture.detectChanges();
    expect(q('bell-panel')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    const detail = document.querySelector('[data-testid="notification-detail-dialog"]');
    expect(detail).not.toBeNull();
    const href = document.querySelector('[data-testid="detail-open-target"]')!.getAttribute('href')!;
    expect(href).toContain('/cumplimiento/controles');
    expect(href).toContain('abrir=ctl-1');
    expect(href).toContain('servicio=svc-1');
  });

  it('a navigation (the browser «Back») with the detail open closes it', async () => {
    setup(0);
    openPanel();
    all('notice-open')[0].click();
    fixture.detectChanges();
    backend.match(() => true).forEach((r) => r.flush(envelope({ items: [] })));
    fixture.detectChanges();
    expect(document.querySelector('[data-testid="notification-detail-dialog"]')).not.toBeNull();
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    expect(document.querySelector('[data-testid="notification-detail-dialog"]')).toBeNull();
  });

  it('closing the detail removes it and returns the focus to the bell', async () => {
    setup(0);
    openPanel();
    all('notice-open')[0].click();
    fixture.detectChanges();
    backend.match(() => true).forEach((r) => r.flush(envelope({ items: [] })));
    fixture.detectChanges();
    (document.querySelector('[data-testid="notification-detail-dialog"]') as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.componentInstance.closeDetail();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="notification-detail-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(q('bell-trigger'));
  });

  it('opening an unread notice marks it read at once, lowers the counter and closes the panel', () => {
    setup(1);
    openPanel();
    all('notice-open')[0].click();
    fixture.detectChanges();
    const patch: TestRequest = backend.expectOne(`${api}/n-1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ is_read: true });
    expect(q('bell-panel')).toBeNull();
    expect(q('bell-count')).toBeNull();
    patch.flush(envelope({ ...unread, is_read: true }));
  });

  it('gives the notice back as unread if the server does not accept the mark', () => {
    setup(1);
    openPanel();
    all('notice-open')[0].click();
    backend.expectOne(`${api}/n-1`).flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(q('bell-count')!.textContent!.trim()).toBe('1');
  });

  it('opening a read notice does not call the server', () => {
    setup(1);
    openPanel();
    all('notice-open')[1].click();
    backend.expectNone(`${api}/n-2`);
  });

  const openMenu = () => {
    q('bell-menu')!.click();
    fixture.detectChanges();
  };

  it('«Marcar todos como leídos» is an item of the actions menu that marks up to the newest notice it showed', () => {
    setup(1);
    openPanel();
    expect(q('bell-mark-all')).toBeNull();
    openMenu();
    expect(q('bell-menu')!.getAttribute('aria-expanded')).toBe('true');
    const button = q('bell-mark-all') as HTMLButtonElement;
    expect(button.getAttribute('role')).toBe('menuitem');
    expect(button.tagName).toBe('BUTTON');
    expect(button.disabled).toBeFalse();
    button.click();
    const req = backend.expectOne(`${api}/read-all`);
    expect(req.request.body).toEqual({ up_to: '2026-12-16T12:00:05Z' });
    req.flush(envelope({ updated_count: 1 }));
    backend.expectOne(`${api}/unread-count`).flush(envelope({ unread_count: 0 }));
    fixture.detectChanges();
    expect(all('bell-item').every((i) => i.getAttribute('data-unread') === 'false')).toBeTrue();
    expect(q('bell-count')).toBeNull();
  });

  it('disables «Marcar todos» when there is nothing unread', () => {
    setup(0);
    openPanel([read]);
    openMenu();
    expect((q('bell-mark-all') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('shows a clear empty state', () => {
    setup(0);
    openPanel([]);
    expect(q('bell-empty')).not.toBeNull();
    expect(q('bell-list')).toBeNull();
  });

  it('shows an error with a retry that asks again', () => {
    setup(0);
    q('bell-trigger')!.click();
    fixture.detectChanges();
    backend.expectOne((r) => r.url === api).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(q('bell-error')).not.toBeNull();
    (q('bell-error')!.querySelector('button') as HTMLButtonElement).click();
    backend.expectOne((r) => r.url === api).flush(pageOf([unread]));
    fixture.detectChanges();
    expect(all('bell-item').length).toBe(1);
  });

  it('groups the notices under «Latest» and «Older»', () => {
    setup(1);
    const old = makeNotification({ id: 'n-9', is_read: true, created_at: '2020-01-01T00:00:00Z' });
    openPanel([unread, old]);
    expect(el().querySelector('[data-bell-group="recent"]')!.textContent).toContain('NOTIFICATIONS.PANEL.RECENT');
    expect(el().querySelector('[data-bell-group="older"]')!.textContent).toContain('NOTIFICATIONS.PANEL.OLDER');
    expect(el().querySelectorAll('[data-bell-group="older"] [data-testid="bell-item"]').length).toBe(1);
  });

  it('«Mostrar solo las no leídas» asks again with status=unread, and says so when there is none', () => {
    setup(0);
    openPanel([read]);
    const toggle = el().querySelector<HTMLButtonElement>('[data-testid="bell-unread-only"] button')!;
    expect(toggle.getAttribute('role')).toBe('switch');
    toggle.click();
    fixture.detectChanges();
    expect(q('bell-loading')).not.toBeNull();
    backend.expectOne((r) => r.url === api && r.params.get('status') === 'unread').flush(pageOf([]));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(q('bell-empty')!.textContent).toContain('NOTIFICATIONS.PANEL.EMPTY_UNREAD_TITLE');
  });

  it('Escape with the actions menu open closes only the menu and gives the focus back to its button', () => {
    setup(1);
    openPanel();
    openMenu();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('bell-mark-all')).toBeNull();
    expect(q('bell-panel')).not.toBeNull();
    expect(document.activeElement).toBe(q('bell-menu'));
  });

  it('closes with Escape and with a click outside', () => {
    setup(0);
    openPanel([read]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('bell-panel')).toBeNull();
    openPanel([read], false);
    document.body.click();
    fixture.detectChanges();
    expect(q('bell-panel')).toBeNull();
  });

  it('updates the open panel without the loading state when a notice arrives live', fakeAsync(() => {
    setup(0);
    openPanel([read]);
    FakeEventSource.last.emit('notification', { unread_count: 1, notification: unread });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS);
    backend.expectOne((r) => r.url === api).flush(pageOf([unread, read]));
    fixture.detectChanges();
    expect(q('bell-loading')).toBeNull();
    expect(all('bell-item').length).toBe(2);
    expect(q('bell-count')!.textContent!.trim()).toBe('1');
  }));

  it('turns a burst of live notices into one request, and a newer one cancels the one still in flight', fakeAsync(() => {
    setup(0);
    openPanel([read]);
    for (let n = 1; n <= 3; n++) {
      FakeEventSource.last.emit('notification', { unread_count: n, notification: unread });
      fixture.detectChanges();
      tick(100);
    }
    backend.expectNone((r) => r.url === api);
    tick(LIVE_RELOAD_DELAY_MS);
    const first = backend.expectOne((r) => r.url === api);
    FakeEventSource.last.emit('notification', { unread_count: 4, notification: unread });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS);
    expect(first.cancelled).toBeTrue();
    backend.expectOne((r) => r.url === api).flush(pageOf([unread, read]));
    fixture.detectChanges();
    expect(all('bell-item').length).toBe(2);
  }));

  it('does not read the panel for a live notice while it is closed', fakeAsync(() => {
    setup(0);
    FakeEventSource.last.emit('notification', { unread_count: 1, notification: unread });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS * 2);
    backend.expectNone((r) => r.url === api);
  }));
});
