import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { Finding, FindingsPage, FindingsSummary } from '@features/compliance/domain/models/finding.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { TestFindings } from './test-findings';

const gap = (id: string, patch: Partial<Finding> = {}): Finding => ({
  id,
  kind: 'gap',
  asset: { id: 'as1', name: 'cuenta-produccion', criticality: 'low' },
  title: `Hallazgo ${id}`,
  evaluated: { text: 'Que la cuenta raíz exija un segundo factor.', language: 'es', is_ai_generated: true },
  remediation: { text: 'Activa **el bloqueo**.\n- Revisa los permisos', language: 'es', is_ai_generated: true },
  priority: 'high',
  priority_basis: { severity: 'critical', asset_criticality: 'low' },
  resources: [{ name: 'bucket-a', uid: 'arn:aws:s3:::bucket-a', region: 'us-east-1' }],
  resources_total: 1,
  exception: null,
  owner: { id: 'u1', name: 'Laura', last_name: 'Gómez' },
  due_date: '2026-12-15',
  failing_since: '2026-11-20T05:40:00Z',
  ...patch,
});
const observation = (id: string): Finding => gap(id, { kind: 'observation', priority: null, priority_basis: null, owner: null, due_date: null, evaluated: null });
const page = (items: Finding[], total = items.length, summary?: FindingsSummary): FindingsPage => ({
  control: { id: 'c1', code: 'IAC-4', name: 'Doble factor' },
  test: { id: 't1', code: 'T-IAC-4-01', display_name: 'Cuentas privilegiadas' },
  measured_at: '2026-11-27T05:40:00Z',
  summary: summary ?? { open_gaps: items.filter((i) => i.kind === 'gap').length, excepted: items.filter((i) => i.kind === 'excepted').length, observations: items.filter((i) => i.kind === 'observation').length },
  items,
  page: 1,
  page_size: 20,
  total,
  total_pages: 1,
});

// D138 · Mensaje de brecha: una tarjeta por check y activo.
describe('TestFindings (D138)', () => {
  let api: jasmine.SpyObj<FindingService>;
  let fixture: ComponentFixture<TestFindings>;

  function setup(result: ReturnType<FindingService['list']>): TestFindings {
    api = jasmine.createSpyObj<FindingService>('FindingService', ['list']);
    api.list.and.returnValue(result);
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalogs.options.and.callFake((name) =>
      of(name === 'gap_priority' ? [{ value: 'high', label: 'Alta' }, { value: 'low', label: 'Baja' }] : [{ value: 'low', label: 'Baja criticidad' }, { value: 'critical', label: 'Crítica' }]),
    );
    TestBed.configureTestingModule({ imports: [TestFindings], providers: [provideTranslateService(), { provide: FindingService, useValue: api }, { provide: CatalogService, useValue: catalogs }] });
    fixture = TestBed.createComponent(TestFindings);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('testId', 't1');
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const open = () => {
    q('[data-findings-toggle]')!.click();
    fixture.detectChanges();
  };
  const close = () => {
    q('[data-detail-close]')!.click();
    fixture.detectChanges();
  };
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('tr[data-clickable]'));
  /** Opens the modal and unfolds the row `i` (accordion). */
  const unfold = (i = 0) => {
    rows()[i].click();
    fixture.detectChanges();
  };
  const openAndUnfold = () => {
    open();
    unfold();
  };

  it('does not ask for anything until the person opens it', () => {
    setup(of(page([])));
    expect(api.list).not.toHaveBeenCalled();
    open();
    expect(api.list).toHaveBeenCalledOnceWith('c1', 't1', 1);
  });

  it('shows a gap with the catalog label of its priority, its basis, what was evaluated and the guidance as plain text', () => {
    setup(of(page([gap('a')])));
    openAndUnfold();
    expect(el().querySelectorAll('[data-finding]').length).toBe(1);
    expect(q('[data-finding-headline]')!.textContent).toContain('Hallazgo a');
    expect(q('[data-finding-asset]')!.textContent).toContain('cuenta-produccion');
    expect(q('[data-finding-priority-chip]')!.textContent).toContain('Alta');
    const basis = q('[data-finding-basis]')!.textContent!;
    expect(basis).toContain('PRIORITY_BASIS');
    expect(basis).not.toContain('PRIORITY_BASIS_PROBE');
    expect(q('[data-finding-evaluated]')!.textContent).toContain('segundo factor');
    expect(q('[data-finding-detail]')!.textContent).toContain('bucket-a');
    const guide = q('[data-finding-remediation]')!.textContent!;
    expect(guide).toContain('Activa el bloqueo.');
    expect(guide).not.toContain('**');
    expect(guide).toContain('Revisa los permisos');
    expect(q('[data-finding-closes]')).not.toBeNull();
    expect(q('[data-finding-owner]')!.textContent).toContain('Laura Gómez');
    const since = q('[data-finding-since]')!;
    expect(since.tagName).toBe('DD');
    expect(since.previousElementSibling!.textContent).toContain('FAILING_SINCE_LABEL');
    expect(since.textContent).toContain('2026');
    expect(since.textContent).not.toContain('T05:40');
  });

  it('explains a probe gap by the asset criticality alone', () => {
    setup(of(page([gap('a', { priority: 'low', priority_basis: { severity: null, asset_criticality: 'low' } })])));
    openAndUnfold();
    expect(q('[data-finding-basis]')!.textContent).toContain('PRIORITY_BASIS_PROBE');
  });

  it('marks an excepted gap and says until when the exception holds', () => {
    setup(of(page([gap('a', { kind: 'excepted', exception: { id: 'e1', effective_until: '2027-01-31' } })])));
    openAndUnfold();
    expect(q('[data-finding-excepted]')).not.toBeNull();
    expect(q('[data-finding-excepted-until]')).not.toBeNull();
    expect(q('[data-finding-priority-chip]')).not.toBeNull();
  });

  it('shows an observation as a reduced row, with no priority, owner, date or closing text', () => {
    setup(of(page([observation('o')])));
    openAndUnfold();
    expect(q('[data-finding-observation]')).not.toBeNull();
    expect(q('[data-finding-headline]')!.textContent).toContain('Hallazgo o');
    expect(q('[data-finding-priority-chip]')).toBeNull();
    expect(q('[data-finding-detail]')!.textContent).toContain('OBSERVATION_NOTE');
    expect(q('[data-finding-remediation]')).not.toBeNull();
    for (const s of ['[data-finding-priority]', '[data-finding-owner]', '[data-finding-due]', '[data-finding-closes]', '[data-finding-since]', '[data-finding-evaluated]']) expect(q(s)).toBeNull();
  });

  it('hides «what was checked» when there is none', () => {
    setup(of(page([gap('a', { evaluated: null })])));
    openAndUnfold();
    expect(q('[data-finding-evaluated]')).toBeNull();
  });

  it('says there is no owner nor commitment date instead of inventing them', () => {
    setup(of(page([gap('a', { owner: null, due_date: null })])));
    open();
    expect(q('[data-finding-owner]')!.textContent).toContain('NO_OWNER');
    expect(q('[data-finding-due]')!.textContent).toContain('NO_DUE');
  });

  it('formats the commitment date', () => {
    setup(of(page([gap('a')])));
    open();
    expect(q('[data-finding-due]')!.textContent).toContain('2026');
    expect(q('[data-finding-due]')!.textContent).not.toContain('2026-12-15');
  });

  it('shows the three counters of the summary and hides the ones at zero', () => {
    setup(of(page([gap('a'), observation('o')], 2, { open_gaps: 1, excepted: 0, observations: 1 })));
    open();
    expect(q('[data-summary-gaps]')).not.toBeNull();
    expect(q('[data-summary-observations]')).not.toBeNull();
    expect(q('[data-summary-excepted]')).toBeNull();
  });

  it('shows a command in its own block, separate from the prose', () => {
    setup(of(page([gap('a', { remediation: { text: 'Ejecute:\n```\nsystemctl unmask tmp.mount\n```\nY reinicie.', language: 'es', is_ai_generated: true } })])));
    openAndUnfold();
    expect(q('[data-finding-code]')?.textContent).toBe('systemctl unmask tmp.mount');
    expect(q('[data-finding-remediation]')!.textContent).toContain('Y reinicie.');
  });

  it('says it was translated by AI when nobody has reviewed the translation', () => {
    setup(of(page([gap('a')])));
    openAndUnfold();
    expect(q('[data-finding-ai]')).not.toBeNull();
    expect(q('[data-finding-original]')).toBeNull();
  });

  it('says the guidance is the English original when there is no translation', () => {
    setup(of(page([gap('a', { remediation: { text: 'Block public access.', language: 'en', is_ai_generated: false } })])));
    openAndUnfold();
    expect(q('[data-finding-original]')).not.toBeNull();
    expect(q('[data-finding-ai]')).toBeNull();
  });

  it('does not invent guidance when the check has none', () => {
    setup(of(page([gap('a', { remediation: null })])));
    openAndUnfold();
    expect(q('[data-finding-no-guide]')).not.toBeNull();
  });

  it('shows five resources and lets the person see all of them', () => {
    const resources = Array.from({ length: 8 }, (_, i) => ({ name: `r${i}`, uid: `u${i}`, region: null }));
    setup(of(page([gap('a', { resources, resources_total: 8 })])));
    openAndUnfold();
    expect(el().querySelectorAll('[data-finding-resources] ul li').length).toBe(5);
    q('[data-finding-show-all]')!.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-finding-resources] ul li').length).toBe(8);
  });

  it('says so when the last measurement left no gaps', () => {
    setup(of(page([])));
    open();
    expect(q('[data-findings-empty]')).not.toBeNull();
  });

  it('offers to retry when loading fails', () => {
    const c = setup(throwError(() => new HttpErrorResponse({ status: 500 })));
    open();
    expect(q('[data-findings-error]')).not.toBeNull();
    api.list.and.returnValue(of(page([gap('a')])));
    c.load();
    fixture.detectChanges();
    expect(q('[data-finding]')).not.toBeNull();
  });

  it('asks for the next page when there are more findings', () => {
    setup(of(page([gap('a')], 2)));
    open();
    api.list.and.returnValue(of({ ...page([gap('b')], 2), page: 2 }));
    q('[data-findings-more]')!.click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('c1', 't1', 2);
    expect(el().querySelectorAll('[data-finding]').length).toBe(2);
    expect(q('[data-findings-more]')).toBeNull();
  });

  it('counts only the last load when it is reopened while loading', () => {
    const first = new Subject<FindingsPage>();
    const second = new Subject<FindingsPage>();
    const c = setup(first);
    open();
    close();
    api.list.and.returnValue(second);
    open();
    first.next(page([gap('old')]));
    first.complete();
    fixture.detectChanges();
    expect(c.stage()).toBe('loading');
    second.next(page([gap('new')]));
    second.complete();
    fixture.detectChanges();
    expect(c.stage()).toBe('ready');
    expect(c.items()[0].id).toBe('new');
    expect(first.observed).toBeFalse();
  });

  it('stays closed when it is closed while loading', () => {
    const pending = new Subject<FindingsPage>();
    const c = setup(pending);
    open();
    close();
    pending.next(page([gap('a')]));
    pending.complete();
    fixture.detectChanges();
    expect(c.stage()).toBe('closed');
    expect(c.items()).toEqual([]);
  });

  it('shows the error notice and retries when the next page fails', () => {
    setup(of(page([gap('a')], 2)));
    open();
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    q('[data-findings-more]')!.click();
    fixture.detectChanges();
    expect(q('[data-findings-more-error]')).not.toBeNull();
    api.list.and.returnValue(of({ ...page([gap('b')], 2), page: 2 }));
    q('[data-findings-more-error] button')!.click();
    fixture.detectChanges();
    expect(q('[data-findings-more-error]')).toBeNull();
    expect(el().querySelectorAll('[data-finding]').length).toBe(2);
  });

  it('opens the gaps in a modal headed by the test code and name, not inside the panel', () => {
    setup(of(page([gap('a')])));
    expect(q('[data-testid="findings-modal-dialog"]')).toBeNull();
    open();
    expect(q('[data-testid="findings-modal-dialog"]')).not.toBeNull();
    expect(q('[data-findings-test]')!.textContent).toContain('T-IAC-4-01');
    expect(q('[data-findings-test]')!.textContent).toContain('Cuentas privilegiadas');
    expect(q('[data-findings-modal-summary]')).not.toBeNull();
  });

  it('keeps the counters next to the link after the modal is closed, and cancels on close', () => {
    setup(of(page([gap('a')])));
    expect(q('[data-findings-summary]')).toBeNull();
    open();
    close();
    expect(q('[data-testid="findings-modal-dialog"]')).toBeNull();
    expect(q('[data-findings-summary] [data-summary-gaps]')).not.toBeNull();
  });

  it('unfolds one row at a time and folds it again on a second click', () => {
    setup(of(page([gap('a'), gap('b')])));
    open();
    expect(q('[data-row-detail]')).toBeNull();
    unfold(0);
    expect(el().querySelectorAll('[data-row-detail]').length).toBe(1);
    expect(rows()[0].getAttribute('aria-expanded')).toBe('true');
    unfold(1);
    expect(el().querySelectorAll('[data-row-detail]').length).toBe(1);
    expect(rows()[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows()[1].getAttribute('aria-expanded')).toBe('true');
    unfold(1);
    expect(q('[data-row-detail]')).toBeNull();
  });
});
