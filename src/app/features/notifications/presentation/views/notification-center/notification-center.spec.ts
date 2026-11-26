import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { NotificationStreamService } from '@features/notifications/domain/services/notification-stream.service';
import { FakeEventSource, provideFakeEventSource } from '@features/notifications/testing/fake-event-source';
import { envelope, makeNotification, pageOf } from '@features/notifications/testing/notification-fixtures';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { LIVE_RELOAD_DELAY_MS, NotificationCenterView } from './notification-center';

const api = `${environment.apiUrl}/me/notifications`;
const catalog = `${environment.apiUrl}/catalogs/notification_type`;

describe('NotificationCenterView', () => {
  let fixture: ComponentFixture<NotificationCenterView>;
  let backend: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('[data-testid="center-item"]'));
  const openRow = (i: number) => rows()[i].querySelector<HTMLElement>('[data-testid="notice-open"]')!.click();
  const doc = (sel: string) => document.querySelector<HTMLElement>(sel);

  const due = makeNotification({ id: 'n-1', created_at: '2026-12-16T12:00:05Z' });
  const approved = makeNotification({
    id: 'n-2', type: 'evidence_approved', is_read: true, created_at: '2026-12-15T12:00:00Z', title: 'IAC-03 · Evidencia validada',
    control: { id: 'ctl-2', code: 'IAC-03', name: 'Acceso con MFA', requirement_codes: ['CC6.1'] }, target: { kind: 'control', id: 'ctl-2', service_id: 'svc-2' }, service: { id: 'svc-2', name: 'Portal de clientes' },
  });

  function setup(items = [due, approved]) {
    TestBed.configureTestingModule({
      imports: [NotificationCenterView],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), provideFakeEventSource()],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'delegado' }, { id: 'c', name: 'ACME' });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    // La campana del shell abre el canal; aquí lo abre la prueba.
    TestBed.inject(NotificationStreamService).start();
    backend.expectOne(`${api}/unread-count`).flush(envelope({ unread_count: 1 }));
    fixture = TestBed.createComponent(NotificationCenterView);
    fixture.detectChanges();
    backend.expectOne(catalog).flush(envelope({ items: [{ value: 'window_due_soon', label: 'Ventana por vencer' }, { value: 'evidence_approved', label: 'Evidencia validada' }] }));
    respondList(items);
  }

  function respondList(items: unknown[], matcher?: (params: (k: string) => string | null) => boolean) {
    const req = backend.expectOne((r) => r.url === api && (!matcher || matcher((k) => r.params.get(k))));
    req.flush(pageOf(items as never[]));
    fixture.detectChanges();
  }

  afterEach(() => {
    backend.match(`${api}/unread-count`).forEach((r) => (r.cancelled ? undefined : r.flush(envelope({ unread_count: 0 }))));
    TestBed.inject(NotificationStreamService).stop();
    backend.verify();
    FakeEventSource.all = [];
  });

  it('shows the skeleton of complete cards while it loads', () => {
    TestBed.configureTestingModule({
      imports: [NotificationCenterView],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), provideFakeEventSource()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationCenterView);
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-skeleton-block]').length).toBeGreaterThan(0);
    expect(el().querySelectorAll('[data-testid="notice-card-skeleton"]').length).toBeGreaterThan(1);
    expect(el().querySelector('[data-testid="center-loading"]')!.getAttribute('aria-busy')).toBe('true');
    backend.expectOne(catalog).flush(envelope({ items: [] }));
    backend.expectOne((r) => r.url === api).flush(pageOf([]));
  });

  async function setupStandalone(streamAlreadyOpen = false): Promise<RouterTestingHarness> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideTranslateService({ fallbackLang: 'es' }), provideFakeEventSource(),
        provideRouter([{ path: 'ventana', component: NotificationCenterView }]),
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role: 'delegado' }, { id: 'c', name: 'ACME' });
    backend = TestBed.inject(HttpTestingController);
    if (streamAlreadyOpen) TestBed.inject(NotificationStreamService).start();
    return RouterTestingHarness.create('/ventana');
  }

  function flushStandalone(harness: RouterTestingHarness, unreadCall = true): void {
    if (unreadCall) backend.expectOne(`${api}/unread-count`).flush(envelope({ unread_count: 1 }));
    backend.expectOne(catalog).flush(envelope({ items: [] }));
    backend.expectOne((r) => r.url === api).flush(pageOf([due]));
    harness.detectChanges();
  }

  it('opens the live channel on entering (there is no bell outside the shell) and closes it on leaving, with the preferences link and the back button', async () => {
    const harness = await setupStandalone();
    flushStandalone(harness);
    const root = harness.routeNativeElement!;
    expect(root.querySelector('[data-testid="center-preferences"]')!.getAttribute('href')).toBe('/ajustes/notificaciones');
    expect(root.querySelector('[data-testid="center-back"]')).not.toBeNull();
    expect(FakeEventSource.all.length).toBe(1);
    const stop = spyOn(TestBed.inject(NotificationStreamService), 'stop').and.callThrough();
    await harness.navigateByUrl('/');
    expect(stop).toHaveBeenCalled();
  });

  it('does not close a channel it did not open', async () => {
    const harness = await setupStandalone(true);
    flushStandalone(harness);
    const source = FakeEventSource.last;
    await harness.navigateByUrl('/');
    expect(source.closed).toBeFalse();
    TestBed.inject(NotificationStreamService).stop();
  });

  it('«Volver a la aplicación» goes back to the screen the person came from (the start if they came straight in)', () => {
    setup();
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    el().querySelector<HTMLElement>('[data-testid="center-back"]')!.click();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('paginates the cards and changes the page size', () => {
    const many = Array.from({ length: 30 }, (_, i) => makeNotification({ id: `n-${i}`, created_at: `2026-12-${String(20 - (i % 10)).padStart(2, '0')}T12:00:00Z` }));
    setup(many);
    const count = () => el().querySelectorAll('[data-testid="center-item"]').length;
    expect(count()).toBe(10);
    fixture.componentInstance.list.goTo(2);
    fixture.detectChanges();
    expect(count()).toBe(10);
    fixture.componentInstance.list.goTo(3);
    fixture.detectChanges();
    expect(count()).toBe(10);
    fixture.componentInstance.list.resize(25);
    fixture.detectChanges();
    expect(count()).toBe(25);
  });

  it('lists the notices with the search on top at full width, the codes visible and the unread ones marked', () => {
    setup();
    expect(el().querySelector('[data-toolbar-search]')).not.toBeNull();
    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('Plataforma de pagos');
    expect(rows()[0].querySelector('[data-testid="notice-summary"]')!.textContent).toContain('no tiene evidencia válida');
    expect(Array.from(rows()[0].querySelectorAll('app-tag')).map((t) => t.textContent!.trim())).toEqual(['IAC-12', 'CC6.1', 'CC6.2']);
    expect(rows()[0].querySelector('[data-testid="notice-icon"]')!.getAttribute('title')).toBe('Ventana por vencer');
    expect(rows()[0].querySelector('[data-unread="true"]')).not.toBeNull();
    expect(rows()[1].querySelector('[data-unread="false"]')).not.toBeNull();
  });

  it('searches over the loaded notices by code, requirement, service or text', () => {
    setup();
    const search = el().querySelector<HTMLInputElement>('[data-search-input]')!;
    search.value = 'portal';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('IAC-03');
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().textContent).toContain('NOTIFICATIONS.CENTER.EMPTY_FILTERED_TITLE');
    (el().querySelector('[data-testid="center-clear"]') as HTMLButtonElement).click();
    respondList([due, approved]);
    expect(rows().length).toBe(2);
  });

  it('asks the server again with the read filter and the type', () => {
    setup();
    const chips = Array.from(el().querySelectorAll<HTMLButtonElement>('app-option-chips button'));
    expect(chips.length).toBe(3);
    chips[1].click();
    respondList([due], (p) => p('status') === 'unread');
    expect(rows().length).toBe(1);
    const filter = fixture.componentInstance;
    filter.pickType('window_due_soon');
    respondList([due], (p) => p('status') === 'unread' && p('type') === 'window_due_soon');
    expect(rows().length).toBe(1);
  });

  it('says clearly that there are no notices at all', () => {
    setup([]);
    expect(el().textContent).toContain('NOTIFICATIONS.CENTER.EMPTY_TITLE');
    expect(el().textContent).not.toContain('NOTIFICATIONS.CENTER.EMPTY_FILTERED_TITLE');
  });

  it('shows an error with a retry', () => {
    TestBed.configureTestingModule({
      imports: [NotificationCenterView],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideTranslateService({ fallbackLang: 'es' }), provideFakeEventSource()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationCenterView);
    fixture.detectChanges();
    backend.expectOne(catalog).flush(envelope({ items: [] }));
    backend.expectOne((r) => r.url === api).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    (el().querySelector('[data-testid="center-retry"]') as HTMLButtonElement).click();
    respondList([due]);
    expect(rows().length).toBe(1);
  });

  it('opens the detail in the side panel, marks the notice read and lets the person leave it unread again', async () => {
    setup();
    openRow(0);
    const patch = backend.expectOne(`${api}/n-1`);
    expect(patch.request.body).toEqual({ is_read: true });
    patch.flush(envelope({ ...due, is_read: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toContain('abrir=n-1');
    expect(doc('[data-testid="notification-detail-dialog"]')).not.toBeNull();
    expect(doc('[data-field="how_to_fix"]')!.textContent).toContain('Sube la evidencia');
    expect(rows()[0].querySelector('[data-unread="false"]')).not.toBeNull();

    (doc('[data-testid="detail-toggle-read"]') as HTMLButtonElement).click();
    const undo = backend.expectOne(`${api}/n-1`);
    expect(undo.request.body).toEqual({ is_read: false });
    undo.flush(envelope({ ...due, is_read: false }));
    fixture.detectChanges();
    expect(rows()[0].querySelector('[data-unread="true"]')).not.toBeNull();
  });

  it('keeps the panel open when a filter would take the notice out of the list', fakeAsync(() => {
    setup([due]);
    fixture.componentInstance.pickStatus('unread');
    respondList([due], (p) => p('status') === 'unread');
    openRow(0);
    backend.expectOne(`${api}/n-1`).flush(envelope({ ...due, is_read: true }));
    tick();
    FakeEventSource.last.emit('unread_count', { unread_count: 0 });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS);
    respondList([], (p) => p('status') === 'unread');
    tick();
    fixture.detectChanges();
    expect(doc('[data-testid="notification-detail-dialog"]')).not.toBeNull();
  }));

  it('«Marcar todos como leídos» is a button that marks up to the newest one loaded', () => {
    setup();
    const button = el().querySelector<HTMLButtonElement>('[data-testid="center-mark-all"]')!;
    expect(button.disabled).toBeFalse();
    button.click();
    const req = backend.expectOne(`${api}/read-all`);
    expect(req.request.body).toEqual({ up_to: '2026-12-16T12:00:05Z' });
    req.flush(envelope({ updated_count: 1 }));
    backend.expectOne(`${api}/unread-count`).flush(envelope({ unread_count: 0 }));
    respondList([{ ...due, is_read: true }, approved]);
    expect(rows()[0].querySelector('[data-unread="false"]')).not.toBeNull();
  });

  it('reloads quietly when a notice arrives live (no skeleton)', fakeAsync(() => {
    setup();
    FakeEventSource.last.emit('notification', { unread_count: 2, notification: due });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS);
    expect(el().querySelectorAll('[data-skeleton-block]').length).toBe(0);
    respondList([makeNotification({ id: 'n-3' }), due, approved]);
    expect(rows().length).toBe(3);
  }));

  it('turns a burst of live notices into one read, and a newer burst cancels the read still in flight', fakeAsync(() => {
    setup();
    for (let n = 1; n <= 4; n++) {
      FakeEventSource.last.emit('notification', { unread_count: n, notification: due });
      fixture.detectChanges();
      tick(100);
    }
    backend.expectNone((r) => r.url === api);
    tick(LIVE_RELOAD_DELAY_MS);
    const first = backend.expectOne((r) => r.url === api);
    FakeEventSource.last.emit('notification', { unread_count: 5, notification: due });
    fixture.detectChanges();
    tick(LIVE_RELOAD_DELAY_MS);
    expect(first.cancelled).toBeTrue();
    respondList([makeNotification({ id: 'n-3' }), due, approved]);
    expect(rows().length).toBe(3);
    tick(LIVE_RELOAD_DELAY_MS * 2);
    backend.expectNone((r) => r.url === api);
  }));

  describe('a link to a notice that is not in the loaded list (?abrir=)', () => {
    const toasts = () => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

    it('asks for the list again and opens the notice if it was there (it arrived a moment ago)', fakeAsync(() => {
      setup();
      const fresh = makeNotification({ id: 'n-9', is_read: true });
      void router.navigateByUrl('/?abrir=n-9');
      tick();
      fixture.detectChanges();
      respondList([fresh, due, approved]);
      tick();
      fixture.detectChanges();
      expect(doc('[data-testid="notification-detail-dialog"]')).not.toBeNull();
      expect(toasts()).toBe('');
      expect(router.url).toContain('abrir=n-9');
    }));

    it('says the notice is no longer available and drops the parameter, instead of doing nothing', fakeAsync(() => {
      setup();
      void router.navigateByUrl('/?abrir=gone');
      tick();
      fixture.detectChanges();
      respondList([due, approved]);
      tick();
      fixture.detectChanges();
      expect(toasts()).toContain('NOTIFICATIONS.CENTER.NOT_AVAILABLE');
      expect(router.url).not.toContain('abrir');
      expect(doc('[data-testid="notification-detail-dialog"]')).toBeNull();
      backend.expectNone((r) => r.url === api);
    }));
  });
});
