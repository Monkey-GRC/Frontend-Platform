import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ControlListItem } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { ControlsListView } from './controls-list';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';

const ITEM: ControlListItem = {
  id: 'c1',
  code: 'IAC-12',
  requirement_codes: ['CC6.1', 'CC6.2'],
  own_code: null,
  name: 'Gestión de accesos de usuarios',
  origin: 'catalog',
  type: 'hybrid',
  trust_criteria: ['security'],
  approval: 'approved',
  readiness: 'not_measured',
  progress: { done: 0, total: 5 },
  coverage: { measured: 0, applicable: 5 },
  owner: null, executor: null, management_state: 'non_compliant', management: { owner_approved_by: null, owner_approved_at: null, approved_by: null, approved_at: null, returned_reason: null, returned_by: null, returned_at: null },
};

const PAGE = { page: { page: 1, pageSize: 25, total: 1, totalPages: 1 } };

describe('ControlsListView', () => {
  let api: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<ControlsListView>;

  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function setup(role: string): ControlsListView {
    query = new BehaviorSubject(convertToParamMap({}));
    api = jasmine.createSpyObj<ControlService>('ControlService', ['list']);
    api.list.and.returnValue(of({ items: [ITEM], ...PAGE }));
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalogs.options.and.returnValue(of([{ value: 'security', label: 'Seguridad' }, { value: 'availability', label: 'Disponibilidad' }]));
    TestBed.configureTestingModule({
      imports: [ControlsListView],
      providers: [
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
        { provide: ControlService, useValue: api },
        { provide: CatalogService, useValue: catalogs },
        { provide: ActiveComplianceService, useValue: { serviceId: signal<string | null>('s1') } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlsListView);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = () => fixture.nativeElement as HTMLElement;

  it('loads the first page of the service with no filters, in the technical view for the company admin', () => {
    setup('admin_empresa');
    expect(api.list).toHaveBeenCalledWith('s1', { page: 1, pageSize: 25, trustCriterion: null, readiness: null }, 'technical');
    expect(text()).toContain('Gestión de accesos de usuarios');
    expect(text()).toContain('Seguridad');
  });

  it('asks for the technical view for the company admin and the auditor, and not for the owner and the delegate', () => {
    setup('auditor');
    expect(api.list.calls.mostRecent().args[2]).toBe('technical');
    TestBed.resetTestingModule();
    setup('admin_empresa');
    expect(api.list.calls.mostRecent().args[2]).toBe('technical');
    TestBed.resetTestingModule();
    setup('responsable');
    expect(api.list.calls.mostRecent().args[2]).toBeUndefined();
  });

  it('always shows the code above the control name, with the requirements it covers (D80)', () => {
    const view = setup('admin_empresa');
    api.list.and.returnValue(of({ items: [{ ...ITEM, code: 'IAC-12', requirement_codes: ['CC6.1', 'CC6.2'] }], ...PAGE }));
    view.load();
    fixture.detectChanges();
    expect(view.columns()[0].key).toBe('name');
    expect(el().querySelector('[data-codes]')!.textContent).toContain('IAC-12');
    expect(text()).toContain('IAC-12');
    expect(text()).toContain('CC6.1');
    expect(text()).toContain('CC6.2');
  });

  it('shows a Management column with the state of each control as a chip', () => {
    const view = setup('responsable');
    api.list.and.returnValue(of({ items: [{ ...ITEM, management_state: 'pending_approval' }], ...PAGE }));
    view.load();
    fixture.detectChanges();
    expect(view.columns().map((c) => c.key)).toContain('management');
    const chip = el().querySelector('[data-management]')!;
    expect(chip.getAttribute('data-management')).toBe('pending_approval');
    expect(chip.getAttribute('data-tone')).toBe('info');
  });

  it('shows progress with its count and the coverage below as a percentage, without repeating the counts, truncated and never a bare number', () => {
    const view = setup('admin_empresa');
    expect(view.pct(3, 5).replace(/\s/g, '')).toBe('60%');
    expect(view.pct(199, 200).replace(/\s/g, '')).toBe('99%');
    expect(view.pct(0, 0)).toBe('—');
    expect(el().querySelector('[data-progress]')!.textContent).toContain('COMPLIANCE.CONTROLS.PROGRESS_VALUE');
    expect(el().querySelector('[data-coverage]')!.textContent).toContain('COMPLIANCE.CONTROLS.COVERAGE_SHORT');
  });

  it('asks the backend again from page 1 when a topic is picked, and toggles it off when picked twice', () => {
    const view = setup('admin_empresa');
    view.goTo(3);
    view.pickTopic('security');
    expect(api.list.calls.mostRecent().args[1]).toEqual({ page: 1, pageSize: 25, trustCriterion: 'security', readiness: null });
    view.pickTopic('security');
    expect(api.list.calls.mostRecent().args[1].trustCriterion).toBeNull();
  });

  it('filters by status and goes back to page 1', () => {
    const view = setup('admin_empresa');
    view.goTo(2);
    view.pickReadiness('needs_work');
    expect(api.list.calls.mostRecent().args[1]).toEqual({ page: 1, pageSize: 25, trustCriterion: null, readiness: 'needs_work' });
    view.clearFilters();
    expect(api.list.calls.mostRecent().args[1]).toEqual({ page: 1, pageSize: 25, trustCriterion: null, readiness: null });
  });

  it('puts the row that is picked in the address (?abrir=) and opens the detail from it', () => {
    const view = setup('admin_empresa');
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    view.open(ITEM);
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { abrir: 'c1', tab: null } }));
    query.next(convertToParamMap({ abrir: 'c1', tab: 'evidence' }));
    expect(view.selected()).toBe('c1');
    expect(view.tab()).toBe('evidence');
  });

  it('refreshes the list in the background after an act in the panel: same page and filters, no loading state', () => {
    const view = setup('admin_empresa');
    view.pickReadiness('ready');
    view.goTo(2);
    api.list.calls.reset();
    const fresh = new Subject<{ items: ControlListItem[]; page: PageInfo }>();
    api.list.and.returnValue(fresh);
    view.refresh();
    expect(api.list).toHaveBeenCalledOnceWith(jasmine.any(String), jasmine.objectContaining({ page: 2, readiness: 'ready' }), jasmine.anything());
    expect(view.stage()).toBe('ready');
    expect(view.loadingPage()).toBeFalse();
    fresh.next({ items: [{ ...ITEM, progress: { done: 0, total: 2 } }], ...PAGE });
    expect(view.rows()[0].progress.total).toBe(2);
  });

  it('a failed background refresh warns with a toast; if it replaced a page change in flight it asks for the list again', () => {
    const view = setup('admin_empresa');
    api.list.calls.reset();
    api.list.and.returnValue(throwError(() => new Error('down')));
    view.refresh();
    expect(TestBed.inject(ToastService).toasts().length).toBe(1);
    expect(api.list).toHaveBeenCalledTimes(1);
    const inFlight = new Subject<{ items: ControlListItem[]; page: PageInfo }>();
    api.list.and.returnValue(inFlight);
    view.goTo(2);
    expect(view.loadingPage()).toBeTrue();
    api.list.calls.reset();
    api.list.and.returnValue(throwError(() => new Error('down')));
    view.refresh();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('shows the error state with a retry when the list cannot be loaded', () => {
    const view = setup('admin_empresa');
    api.list.and.returnValue(throwError(() => new Error('down')));
    view.load();
    fixture.detectChanges();
    expect(view.stage()).toBe('error');
    expect(text()).toContain('COMPLIANCE.CONTROLS.LOAD_ERROR_TITLE');
  });

  it('while it loads marks the zone busy with a progress bar and the slow text after 2 s; the busy mark goes when the list arrives', fakeAsync(() => {
    const pending = new Subject<{ items: ControlListItem[]; page: PageInfo }>();
    setup('admin_empresa');
    api.list.and.returnValue(pending);
    fixture.componentInstance.load();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-skeleton-region')!.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('[data-load-progress]')).not.toBeNull();
    expect(el.querySelector('[data-slow-load]')).toBeNull();
    tick(2000);
    fixture.detectChanges();
    expect(el.querySelector('[data-slow-load]')).not.toBeNull();
    pending.next({ items: [ITEM], ...PAGE });
    fixture.detectChanges();
    expect(el.querySelector('app-skeleton-region')!.hasAttribute('aria-busy')).toBeFalse();
    flush();
  }));

  it('does not stay loading when the request never answers: after the timeout it shows the error with Retry', fakeAsync(() => {
    setup('admin_empresa');
    api.list.and.returnValue(new Subject());
    fixture.componentInstance.load();
    fixture.detectChanges();
    tick(LOAD_TIMEOUT_MS);
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('error');
    expect(text()).toContain('COMMON.RETRY');
  }));
});
