import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ControlListItem } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
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
  assigned_to: null,
};

const PAGE = { page: { page: 1, pageSize: 25, total: 1, totalPages: 1 } };

describe('ControlsListView', () => {
  let api: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<ControlsListView>;

  function setup(role: string): ControlsListView {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['list']);
    api.list.and.returnValue(of({ items: [ITEM], ...PAGE }));
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalogs.options.and.returnValue(of([{ value: 'security', label: 'Seguridad' }, { value: 'availability', label: 'Disponibilidad' }]));
    TestBed.configureTestingModule({
      imports: [ControlsListView],
      providers: [
        provideTranslateService(),
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

  it('always shows the code column, with the control code and the requirements it covers (D80)', () => {
    const view = setup('admin_empresa');
    api.list.and.returnValue(of({ items: [{ ...ITEM, code: 'IAC-12', requirement_codes: ['CC6.1', 'CC6.2'] }], ...PAGE }));
    view.load();
    fixture.detectChanges();
    expect(view.columns()[0].key).toBe('code');
    expect(text()).toContain('IAC-12');
    expect(text()).toContain('CC6.1');
    expect(text()).toContain('CC6.2');
  });

  it('shows compliance and coverage as percentages together with the counts, truncated and never a bare number', () => {
    const view = setup('admin_empresa');
    expect(view.pct(3, 5).replace(/\s/g, '')).toBe('60%');
    expect(view.pct(199, 200).replace(/\s/g, '')).toBe('99%');
    expect(view.pct(0, 0)).toBe('—');
    expect(text()).toContain('COMPLIANCE.CONTROLS.PROGRESS');
    expect(text()).toContain('COMPLIANCE.CONTROLS.COVERAGE');
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

  it('opens the detail of the row that is picked', () => {
    const view = setup('admin_empresa');
    view.open(ITEM);
    expect(view.selected()).toBe('c1');
  });

  it('shows the error state with a retry when the list cannot be loaded', () => {
    const view = setup('admin_empresa');
    api.list.and.returnValue(throwError(() => new Error('down')));
    view.load();
    fixture.detectChanges();
    expect(view.stage()).toBe('error');
    expect(text()).toContain('COMPLIANCE.CONTROLS.LOAD_ERROR_TITLE');
  });
});
