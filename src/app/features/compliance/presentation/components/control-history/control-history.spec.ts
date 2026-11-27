import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ControlDetail, ManagementHistoryItem } from '@features/compliance/domain/models/control.models';
import { ControlManagementService, ManagementPage } from '@features/compliance/domain/services/control-management.service';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { provideRouter } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';
import { ControlHistory } from './control-history';

const ANA = { id: 'u1', name: 'Ana', last_name: 'Pérez' };
const item = (id: string, reason?: string): ManagementHistoryItem => ({ id, type: 'return', at: '2026-11-25T10:00:00Z', actor: ANA, test: null, requirement: null, detail: reason ? { reason } : {} });
const page = (items: ManagementHistoryItem[], n = 1, totalPages = 1): ManagementPage<ManagementHistoryItem> => ({ items, page: { page: n, pageSize: 10, total: items.length, totalPages } });
const control = (id: string): ControlDetail => ({ id }) as ControlDetail;

describe('ControlHistory', () => {
  let api: jasmine.SpyObj<ControlManagementService>;
  let fixture: ComponentFixture<ControlHistory>;
  const el = () => fixture.nativeElement as HTMLElement;

  function setup(id = 'c1', role = 'admin_empresa'): ControlHistory {
    api = jasmine.createSpyObj<ControlManagementService>('ControlManagementService', ['history']);
    api.history.and.returnValue(of(page([item('h1', 'Falta la firma')], 1, 2)));
    const options = () => of([{ value: 'return', label: 'Devolución' }]);
    TestBed.configureTestingModule({ imports: [ControlHistory], providers: [provideTranslateService(), provideRouter([]), { provide: ControlManagementService, useValue: api }, { provide: CatalogService, useValue: { options } }] });
    TestBed.inject(SessionService).set({ id: 'me', email: 'me@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlHistory);
    fixture.componentRef.setInput('detail', control(id));
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('is a read-only table: date with time, person, action and detail, rows without click or hover', () => {
    setup();
    const row = el().querySelector('[data-history-table] tbody tr')!;
    expect(row.hasAttribute('data-clickable')).toBeFalse();
    expect(row.getAttribute('tabindex')).toBeNull();
    expect(el().querySelector('[data-history-row]')!.className).toContain('whitespace-nowrap');
    expect(el().querySelector('[data-history-row]')!.textContent).toMatch(/2026/);
    expect(el().querySelector('[data-history-actor]')!.textContent).toContain('Ana Pérez');
    expect(el().querySelector('[data-history-action]')!.textContent).toContain('Devolución');
    expect(el().querySelector('[data-history-why]')!.textContent).toContain('Falta la firma');
  });

  it('cuts a long detail to two lines with Show more, says — without detail and «Automatic» for the system', () => {
    setup();
    const long = 'x'.repeat(500);
    api.history.and.returnValue(of(page([
      { ...item('h1'), detail: { reason: long } },
      { ...item('h2'), type: 'approval_invalidated', actor: null, detail: { step: 'final', cause: 'control_stopped_complying' } },
    ])));
    fixture.componentRef.setInput('detail', control('c9'));
    fixture.detectChanges();
    const why = el().querySelector('[data-history-why] [data-expandable-text]')!;
    expect(why.className).toContain('line-clamp-2');
    expect(why.textContent).toContain(long);
    expect(el().querySelectorAll('[data-history-no-why]').length).toBe(1);
    expect(el().querySelectorAll('[data-history-actor]')[1].textContent).toContain('COMPLIANCE.APPROVAL.HISTORY.SYSTEM');
  });

  it('shows a short detail whole, in the text colour, without «…» or Show more', async () => {
    setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const why = el().querySelector('[data-history-why] [data-expandable-text]')!;
    expect(why.className).toContain('text-ink');
    expect(why.className).not.toContain('text-ink-muted');
    expect(why.textContent).toContain('Falta la firma');
    expect(el().querySelector('[data-history-why] [data-expandable-toggle]')).toBeNull();
  });

  it('shows the person with the initials circle and, for whoever can see Team, a link to their detail there', () => {
    setup();
    api.history.and.returnValue(of(page([{ ...item('h9'), actor: { id: 'u2', name: 'María Fernanda', last_name: 'González Echeverría' } }])));
    fixture.componentRef.setInput('detail', control('c5'));
    fixture.detectChanges();
    // The same circle the person has in Team (first two words of the name).
    expect(el().querySelector('[data-history-avatar]')!.textContent!.trim()).toBe('MF');
    api.history.and.returnValue(of(page([item('h1', 'Falta la firma')])));
    fixture.componentRef.setInput('detail', control('c1'));
    fixture.detectChanges();
    const actor = el().querySelector<HTMLAnchorElement>('a[data-history-actor-link]')!;
    expect(actor.querySelector('[data-history-avatar]')!.textContent!.trim()).toBe('AP');
    expect(actor.querySelector('[data-history-actor-name]')!.textContent).toContain('Ana Pérez');
    const href = actor.getAttribute('href')!;
    expect(href).toContain('/equipo/personas');
    expect(href).toContain('abrir=u1');
    expect(actor.getAttribute('aria-label')).toContain('COMPLIANCE.APPROVAL.HISTORY.OPEN_PERSON');
  });

  for (const role of ['delegado', 'auditor']) {
    it(`for a ${role} (who cannot see Team) the person is the circle and the name, without a link`, () => {
      setup('c1', role);
      expect(el().querySelector('a[data-history-actor-link]')).toBeNull();
      const actor = el().querySelector('[data-history-actor]')!;
      expect(actor.querySelector('[data-history-avatar]')!.textContent!.trim()).toBe('AP');
      expect(actor.textContent).toContain('Ana Pérez');
    });
  }

  it('the system («Automatic») has no person circle and no link', () => {
    setup();
    api.history.and.returnValue(of(page([{ ...item('h2'), actor: null }])));
    fixture.componentRef.setInput('detail', control('c7'));
    fixture.detectChanges();
    const system = el().querySelector('[data-history-system]')!;
    expect(system.textContent).toContain('COMPLIANCE.APPROVAL.HISTORY.SYSTEM');
    expect(el().querySelector('[data-history-avatar]')).toBeNull();
    expect(el().querySelector('a[data-history-actor-link]')).toBeNull();
  });

  it('shows the test or requirement with its code, and the result or the decision as a status', () => {
    setup();
    api.history.and.returnValue(of(page([
      { ...item('h1'), type: 'manual_result', test: { id: 't1', code: 'T-01', display_name: 'Revisión de accesos' }, detail: { result: 'exception', note: 'n' } },
      { ...item('h2'), type: 'not_applicable_decided', requirement: { id: 'r1', code: 'CC6.1' }, detail: { decision: 'rejected', reason: 'r' } },
    ])));
    fixture.componentRef.setInput('detail', control('c8'));
    fixture.detectChanges();
    const targets = el().querySelectorAll('[data-history-target]');
    // The code goes in the same line as the action, with the result next to it (not a tag on a line of its own below).
    const action = el().querySelector('[data-history-action]')!;
    expect(action.contains(targets[0])).toBeTrue();
    expect(action.querySelector('[data-history-outcome]')).not.toBeNull();
    expect(action.className).not.toContain('font-medium');
    expect(targets[0].textContent).toContain('T-01');
    expect(targets[0].textContent).toContain('Revisión de accesos');
    expect(targets[1].textContent).toContain('CC6.1');
    const outcomes = el().querySelectorAll('[data-history-outcome]');
    expect(outcomes[0].getAttribute('data-tone')).toBe('bad');
    expect(outcomes[1].getAttribute('data-tone')).toBe('bad');
  });

  it('empties the rows and shows the skeleton when another control is opened, but keeps them when it is the same control reloading', () => {
    setup('c1');
    const slow = new Subject<ManagementPage<ManagementHistoryItem>>();
    api.history.and.returnValue(slow);
    fixture.componentRef.setInput('detail', control('c1'));
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-history-row]').length).toBe(1);
    fixture.componentRef.setInput('detail', control('c2'));
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-history-row]').length).toBe(0);
    expect(el().querySelector('app-skeleton-region')).not.toBeNull();
    expect(el().querySelector('[data-history-more]')).toBeNull();
  });

  it('discards the answer of a request that was overtaken by a newer one', () => {
    setup('c1');
    const old = new Subject<ManagementPage<ManagementHistoryItem>>();
    const fresh = new Subject<ManagementPage<ManagementHistoryItem>>();
    api.history.and.returnValues(old, fresh);
    fixture.componentRef.setInput('detail', control('c2'));
    fixture.detectChanges();
    fixture.componentRef.setInput('detail', control('c3'));
    fixture.detectChanges();
    fresh.next(page([item('new')]));
    old.next(page([item('old')]));
    fixture.detectChanges();
    const rows = el().querySelectorAll('[data-history-row]');
    expect(rows.length).toBe(1);
    expect(fixture.componentInstance['items']()[0].id).toBe('new');
  });

  it('shows an error next to Show more when the next page fails, and keeps the rows', () => {
    const c = setup();
    api.history.and.returnValue(throwError(() => new Error('x')));
    c.more();
    fixture.detectChanges();
    expect(el().querySelector('[data-history-more-error]')).not.toBeNull();
    expect(el().querySelector('[data-history-more]')).not.toBeNull();
    expect(el().querySelectorAll('[data-history-row]').length).toBe(1);
  });

  it('Show more keeps its focus (aria-busy, not disabled), announces how many were loaded and moves the focus to the first new row', async () => {
    setup();
    const next = new Subject<ManagementPage<ManagementHistoryItem>>();
    api.history.and.returnValue(next);
    const btn = el().querySelector<HTMLButtonElement>('[data-history-more]')!;
    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBeFalse();
    next.next(page([item('h2'), item('h3')], 2, 2));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el().querySelector('[data-history-announce]')!.getAttribute('aria-live')).toBe('polite');
    expect(el().querySelector('[data-history-announce]')!.textContent).toContain('HISTORY.MORE_LOADED');
    expect(document.activeElement).toBe(el().querySelectorAll('[data-history-row]')[1]);
  });

  it('keeps the table and offers a retry when a reload fails with rows already shown', () => {
    const c = setup();
    api.history.and.returnValue(throwError(() => new Error('x')));
    c.reload();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-history-row]').length).toBe(1);
    expect(el().querySelector('[data-history-reload-error]')).not.toBeNull();
    api.history.and.returnValue(of(page([item('h1')])));
    el().querySelector<HTMLButtonElement>('[data-history-reload-retry]')!.click();
    fixture.detectChanges();
    expect(el().querySelector('[data-history-reload-error]')).toBeNull();
  });

  it('ignores a next page that arrives after the history was reloaded', () => {
    const c = setup();
    const late = new Subject<ManagementPage<ManagementHistoryItem>>();
    api.history.and.returnValue(late);
    c.more();
    api.history.and.returnValue(of(page([item('h9')], 1, 1)));
    c.reload();
    late.next(page([item('h2')], 2, 2));
    expect(c['items']().map((i) => i.id)).toEqual(['h9']);
  });

  it('on reload asks again for every page already shown, so "Show more" is not lost', () => {
    const c = setup();
    api.history.and.returnValue(of(page([item('h2')], 2, 3)));
    c.more();
    expect(c['page']()).toBe(2);
    const twenty = Array.from({ length: 20 }, (_, n) => item(`h${n}`));
    api.history.and.returnValue(of({ items: twenty, page: { page: 1, pageSize: 20, total: 35, totalPages: 2 } }));
    c.reload();
    expect(api.history.calls.mostRecent().args).toEqual(['c1', 1, 20]);
    expect(c['items']().length).toBe(20);
    expect(c['page']()).toBe(2);
    expect(c['hasMore']()).toBeTrue();
  });

  it('while it loads shows the progress bar and the slow text after 2 s; the busy mark goes when the rows arrive', fakeAsync(() => {
    setup('c1');
    const slow = new Subject<ManagementPage<ManagementHistoryItem>>();
    api.history.and.returnValue(slow);
    fixture.componentRef.setInput('detail', control('c2'));
    fixture.detectChanges();
    expect(el().querySelector('app-skeleton-region')!.getAttribute('aria-busy')).toBe('true');
    expect(el().querySelector('[data-load-progress]')).not.toBeNull();
    tick(2000);
    fixture.detectChanges();
    expect(el().querySelector('[data-slow-load]')).not.toBeNull();
    slow.next(page([item('h9')]));
    fixture.detectChanges();
    expect(el().querySelector('app-skeleton-region')).toBeNull();
    expect(el().querySelector('[aria-busy="true"]')).toBeNull();
    flush();
  }));

  it('shows the error with Retry when the request fails or never answers', fakeAsync(() => {
    setup('c1');
    api.history.and.returnValue(new Subject());
    fixture.componentRef.setInput('detail', control('c3'));
    fixture.detectChanges();
    tick(LOAD_TIMEOUT_MS);
    fixture.detectChanges();
    expect(el().querySelector('[data-history-error]')!.textContent).toContain('COMMON.RETRY');
    expect(el().querySelector('[aria-busy="true"]')).toBeNull();
  }));
});
