import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Cause, RiskListItem } from '@shared/domain/models/risk.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { RisksView } from './risks';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';

const risk = (id: string, code: string, name: string, criterion: string, level: string | null = null): RiskListItem => ({
  id, code, name, trust_criterion: criterion, origin: 'catalog', is_active: true, likelihood: null, impact: null, inherent_risk_value: null, inherent_risk_level: level, treatment: null, causes_count: 2,
});
const cause = (id: string, code: string, name: string, category: string, origin: 'catalog' | 'own' = 'catalog'): Cause => ({
  id, service_id: 's1', code, name, description: '', failure_category: category, origin, is_active: true, risks: [{ id: 'r1', code: 'R001', name: 'x' }], controls: [],
});

const RISKS = [risk('r2', 'R002', 'Pérdida de datos', 'availability'), risk('r1', 'R001', 'Acceso no autorizado', 'confidentiality'), risk('r3', 'R010', 'Fuga de información', 'confidentiality')];
const CAUSES = [cause('c1', 'F001', 'Cuentas sin dueño', 'human_resource'), cause('c2', 'F002', 'Servidor sin parches', 'information_technology', 'own')];

describe('RisksView', () => {
  let api: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<RisksView>;

  let router: jasmine.SpyObj<Router>;

  function setup(role: string, section: 'risks' | 'causes' = 'risks', abrir: string | null = null): RisksView {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['listAllRisks', 'listAllCauses', 'getRisk', 'getCause']);
    api.listAllRisks.and.returnValue(of(RISKS));
    api.listAllCauses.and.returnValue(of(CAUSES));
    // Los drawers piden su detalle al abrirse; aquí no interesa lo que traigan.
    api.getRisk.and.returnValue(NEVER);
    api.getCause.and.returnValue(NEVER);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [RisksView],
      providers: [
        provideTranslateService(),
        { provide: RiskService, useValue: api },
        { provide: ControlService, useValue: jasmine.createSpyObj<ControlService>('ControlService', ['listAll']) },
        { provide: Router, useValue: router },
        { provide: ActiveComplianceService, useValue: { serviceId: signal<string | null>('s1') } },
        {
          provide: ActivatedRoute,
          useValue: {
            data: new BehaviorSubject({ section }),
            queryParamMap: new BehaviorSubject(convertToParamMap(abrir ? { abrir } : {})),
          },
        },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(RisksView);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('loads all the risks of the service at once, in the technical view for the company admin and in the business view for the owner and the delegate', () => {
    setup('admin_empresa');
    expect(api.listAllRisks).toHaveBeenCalledWith('s1', 'technical');
    TestBed.resetTestingModule();
    setup('responsable');
    expect(api.listAllRisks).toHaveBeenCalledWith('s1', undefined);

    expect(text()).toContain('Acceso no autorizado');
  });

  it('asks for the technical view only for the auditor', () => {
    setup('auditor');
    expect(api.listAllRisks).toHaveBeenCalledWith('s1', 'technical');
  });

  it('groups the risks by the criteria that arrive, ordered by code inside each group, with no fixed list', () => {
    const view = setup('admin_empresa');
    const groups = view.riskGroups();
    expect(groups.map((g) => g.key).sort()).toEqual(['availability', 'confidentiality']);
    expect(groups.find((g) => g.key === 'confidentiality')!.items.map((r) => r.code)).toEqual(['R001', 'R010']);
  });

  it('builds the filter chips only from the values present in the data', () => {
    const view = setup('admin_empresa');
    expect(view.chips().map((c) => c.value)).toEqual(['all', 'availability', 'confidentiality']);
  });

  it('filters by criterion and toggles it off when picked twice', () => {
    const view = setup('admin_empresa');
    view.pickGroup('availability');
    expect(view.riskGroups().length).toBe(1);
    expect(view.visibleCount()).toBe(1);
    view.pickGroup('availability');
    expect(view.visibleCount()).toBe(3);
  });

  it('searches by code or by name', () => {
    const view = setup('admin_empresa');
    view.query.set('r010');
    expect(view.visibleCount()).toBe(1);
    view.query.set('datos');
    expect(view.visibleCount()).toBe(1);
    view.query.set('nada que coincida');
    expect(view.visibleCount()).toBe(0);
    expect(view.hasFilters()).toBeTrue();
  });

  it('is the causes tab on its own route: loads only the causes and groups them by failure category', () => {
    const view = setup('admin_empresa', 'causes');
    expect(view.section()).toBe('causes');
    expect(api.listAllCauses).toHaveBeenCalledWith('s1', 'technical');
    expect(api.listAllRisks).not.toHaveBeenCalled();
    expect(view.causeGroups().map((g) => g.key).sort()).toEqual(['human_resource', 'information_technology']);
    expect(view.chips().map((c) => c.value)).toEqual(['all', 'human_resource', 'information_technology']);
  });

  it('is the risks tab on its own route and does not ask for the causes', () => {
    const view = setup('admin_empresa');
    expect(view.section()).toBe('risks');
    expect(api.listAllCauses).not.toHaveBeenCalled();
  });

  it('shows a cause that belongs to no risk in the causes tab', () => {
    const view = setup('admin_empresa', 'causes');
    api.listAllCauses.and.returnValue(of([{ ...CAUSES[0], id: 'orphan', code: 'F003', risks: [] }]));
    view.load();
    expect(view.causeGroups()[0].items[0].code).toBe('F003');
  });

  it('opens a risk in its own panel when it is in the risks tab, and jumps to the causes tab to open a cause', () => {
    const view = setup('admin_empresa');
    view.openRisk('r1');
    expect(view.selectedRisk()).toBe('r1');
    view.openCause('c1');
    expect(router.navigate).toHaveBeenCalledWith(['/', 'cumplimiento', 'causas'], { queryParams: { abrir: 'c1' } });
  });

  it('opens a cause in its own panel when it is in the causes tab, and jumps to the risks tab to open a risk', () => {
    const view = setup('admin_empresa', 'causes');
    view.openCause('c1');
    expect(view.selectedCause()).toBe('c1');
    view.openRisk('r1');
    expect(router.navigate).toHaveBeenCalledWith(['/', 'cumplimiento', 'riesgos'], { queryParams: { abrir: 'r1' } });
  });

  it('opens the element that arrives in ?abrir= in the tab it belongs to', () => {
    expect(setup('admin_empresa', 'risks', 'r1').selectedRisk()).toBe('r1');
    TestBed.resetTestingModule();
    expect(setup('admin_empresa', 'causes', 'c2').selectedCause()).toBe('c2');
  });

  it('shows the error state with a retry when the data cannot be loaded', () => {
    const view = setup('admin_empresa');
    api.listAllRisks.and.returnValue(throwError(() => new Error('down')));
    view.load();
    fixture.detectChanges();
    expect(view.stage()).toBe('error');
    expect(text()).toContain('COMPLIANCE.RISKS.LOAD_ERROR_TITLE');
  });

  it('draws one table with a section header (and its count) per criterion, and a click on a row opens the risk', () => {
    const view = setup('admin_empresa');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-data-table').length).toBe(1);
    expect(Array.from(el.querySelectorAll('[data-group-header]')).map((h) => h.getAttribute('data-group'))).toEqual(['availability', 'confidentiality']);
    expect(el.querySelectorAll('tbody tr:not([data-group-header])').length).toBe(3);
    expect(el.querySelector('app-risk-level-badge')).not.toBeNull();
    (el.querySelectorAll('tbody tr:not([data-group-header])')[1] as HTMLElement).click();
    expect(view.selectedRisk()).toBe('r1');
  });

  it('draws the causes in the same kind of table, grouped by failure category', () => {
    setup('admin_empresa', 'causes');
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('[data-group-header]')).map((h) => h.getAttribute('data-group'))).toEqual(['human_resource', 'information_technology']);
    expect(el.querySelector('app-risk-level-badge')).toBeNull();
  });

  it('with a search that matches nothing it says so and offers to clear the filters', () => {
    const view = setup('admin_empresa');
    view.query.set('nada que coincida');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('COMPLIANCE.RISKS.EMPTY_FILTERED_TITLE');
    el.querySelector<HTMLButtonElement>('app-empty-state button')!.click();
    expect(view.hasFilters()).toBeFalse();
  });
});
