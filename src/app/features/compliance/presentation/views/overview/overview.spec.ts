import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ComplianceOverview, OverviewCategory, OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { ComplianceContextService } from '@features/compliance/domain/services/compliance-context.service';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { RISK_MATRIX, provideCatalogStub } from '@shared/testing/catalog-options';
import { OverviewView } from './overview';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';

const DEFINED = { catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: '2026-10-14', cutoff_frozen: false };
const UNDEFINED = { catalog_version: null, period_start: null, period_end: null, cutoff_date: null, cutoff_frozen: null };

const category = (criterion: string, patch: Partial<OverviewCategory> = {}): OverviewCategory => ({
  trust_criterion: criterion, readiness: 'almost_ready', progress: { done: 3, total: 4 }, coverage: { measured: 4, applicable: 4 }, failing_controls: [], ...patch,
});
const failing = (id: string, code: string, name: string) => ({
  control_id: id, code, requirement_codes: ['CC6.1'], own_code: null, name, readiness: 'needs_work',
  failing: [{ dimension: 'cloud', affected: [{ kind: 'asset' as const, id: 'a1', name: 'cuenta-aws-produccion' }] }],
});

const framework = (patch: Partial<OverviewFramework> = {}): OverviewFramework => ({
  framework_code: 'soc2', name: 'SOC 2', readiness: 'almost_ready', progress: { done: 4, total: 5 }, coverage: { measured: 5, applicable: 5 }, evaluation: DEFINED,
  categories: [category('security', { failing_controls: [failing('k1', 'IAC-12', 'Gestión de accesos')] })], ...patch,
});
const technical = (state: 'compliant' | 'non_compliant' | 'evaluating') => ({ state, unique_controls: 5, failing: ['IAC-12'], pending: [] });

describe('OverviewView', () => {
  let api: jasmine.SpyObj<OverviewService>;
  let riskApi: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<OverviewView>;

  function setup(role: string, frameworks: OverviewFramework[], result: 'ok' | 'error' | 'pending' = 'ok'): OverviewView {
    api = jasmine.createSpyObj<OverviewService>('OverviewService', ['get', 'setEvaluationPeriod']);
    riskApi = jasmine.createSpyObj<RiskService>('RiskService', ['listAllRisks', 'matrix']);
    riskApi.matrix.and.returnValue(of(RISK_MATRIX));
    riskApi.listAllRisks.and.returnValue(of([]));
    api.get.and.returnValue(result === 'error' ? throwError(() => new Error('x')) : result === 'pending' ? NEVER : of({ service_id: 's1', frameworks } as ComplianceOverview));
    TestBed.configureTestingModule({
      imports: [OverviewView],
      providers: [
        provideTranslateService(), provideRouter([]), provideCatalogStub(),
        { provide: OverviewService, useValue: api },
        { provide: RiskService, useValue: riskApi },
        { provide: ActiveComplianceService, useValue: { serviceId: signal<string | null>('s1') } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(OverviewView);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const q = (selector: string) => el().querySelector(selector);

  it('asks for the technical view when the user is the company admin, and the business view for a owner', () => {
    setup('admin_empresa', [framework()]);
    expect(api.get).toHaveBeenCalledWith('s1', 'technical');
    TestBed.resetTestingModule();
    setup('responsable', [framework()]);
    expect(api.get).toHaveBeenCalledWith('s1', undefined);
  });

  it('says «does not comply» when one control fails, even if the progress is 80 %: the progress is not the status', () => {
    setup('admin_empresa', [framework({ technical: technical('non_compliant') })]);
    expect(q('[data-verdict]')!.getAttribute('data-verdict')).toBe('bad');
    expect(q('[data-verdict-title]')!.textContent).toContain('COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT');
    expect(q('[data-progress]')!.textContent).toContain('80');
    // El avance va con su propio estado y su cobertura, aparte del veredicto.
    expect(q('[data-progress]')!.textContent).toContain('COMMON.READINESS.LABEL.ALMOST_READY');
    expect(q('[data-coverage]')).not.toBeNull();
  });

  it('says «complies» only when the engine says so', () => {
    setup('admin_empresa', [framework({ readiness: 'ready', progress: { done: 5, total: 5 }, categories: [category('security', { progress: { done: 5, total: 5 }, readiness: 'ready' })], technical: technical('compliant') })]);
    expect(q('[data-verdict]')!.getAttribute('data-verdict')).toBe('ok');
    expect(q('[data-verdict-title]')!.textContent).toContain('COMPLIANCE.OVERVIEW.VERDICT.COMPLIANT');
  });

  it('shows what is pending as «under evaluation», never as complying', () => {
    setup('admin_empresa', [framework({ coverage: { measured: 3, applicable: 5 }, technical: technical('evaluating') })]);
    expect(q('[data-verdict]')!.getAttribute('data-verdict')).toBe('warn');
    expect(q('[data-verdict-title]')!.textContent).toContain('COMPLIANCE.OVERVIEW.VERDICT.EVALUATING');
  });

  it('a user without the technical view sees the four-level status instead of the engine verdict', () => {
    setup('responsable', [framework()]);
    expect(q('[data-verdict-title]')!.textContent).toContain('COMMON.READINESS.LABEL.ALMOST_READY');
    expect(text()).not.toContain('COMPLIANCE.OVERVIEW.VERDICT');
  });

  it('a service with no results is «not measured» and invents no percentage; it also says why when the evaluation is not defined', () => {
    setup('admin_empresa', [framework({ readiness: 'not_measured', progress: { done: 0, total: 5 }, coverage: { measured: 0, applicable: 5 }, evaluation: UNDEFINED, technical: technical('evaluating'),
      categories: [category('security', { readiness: 'not_measured', progress: { done: 0, total: 5 }, coverage: { measured: 0, applicable: 5 } })] })]);
    expect(q('[data-verdict]')!.getAttribute('data-verdict')).toBe('neutral');
    expect(q('[data-verdict-title]')!.textContent).toContain('COMMON.READINESS.LABEL.NOT_MEASURED');
    expect(q('[data-progress]')!.textContent).not.toMatch(/\d+\s?%/);
    expect(q('[data-coverage]')!.textContent).toContain('—');
    expect(q('[data-not-defined]')).not.toBeNull();
    expect(q('[data-evaluation]')).toBeNull();
    expect(q('[data-attention-empty]')!.textContent).toContain('ATTENTION_EMPTY_UNMEASURED');
  });

  it('tells the header of the service the period of the evaluation (it is shown there, not in the page), and takes it back when it is not defined', () => {
    setup('admin_empresa', [framework({ technical: technical('non_compliant') })]);
    const context = TestBed.inject(ComplianceContextService);
    expect(q('[data-not-defined]')).toBeNull();
    expect(q('[data-evaluation]')).toBeNull();
    expect(context.evaluationText()).toContain('COMPLIANCE.OVERVIEW.EVALUATION');
    TestBed.resetTestingModule();
    setup('admin_empresa', [framework({ evaluation: UNDEFINED, technical: technical('evaluating') })]);
    expect(TestBed.inject(ComplianceContextService).evaluationText()).toBeNull();
  });

  describe('the audited period (D87, MD-168)', () => {
    const undefinedFw = () => framework({ readiness: 'not_measured', evaluation: UNDEFINED, technical: technical('evaluating') });

    it('the company admin can set the period when it is missing: the button opens the form', () => {
      setup('admin_empresa', [undefinedFw()]);
      expect(q('[data-define-period]')).not.toBeNull();
      expect(q('app-evaluation-period-form')).toBeNull();
      (q('[data-define-period]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-evaluation-period-form')).not.toBeNull();
    });

    it('the other roles are told to ask the administrator, with no button (the API would answer 403)', () => {
      for (const role of ['auditor', 'responsable', 'delegado']) {
        setup(role, [undefinedFw()]);
        expect(q('[data-define-period]')).toBeNull();
        expect(text()).toContain('COMPLIANCE.PERIOD.ASK_ADMIN');
        TestBed.resetTestingModule();
      }
    });

    it('with the period defined, the admin changes it from the banner (no bar here, no cutoff date, D105): the summary hands the banner the action', () => {
      setup('admin_empresa', [framework({ evaluation: { ...DEFINED, cutoff_frozen: true } })]);
      expect(q('[data-not-defined]')).toBeNull();
      expect(q('[data-cutoff]')).toBeNull();
      expect(q('[data-period-bar]')).toBeNull();
      const context = TestBed.inject(ComplianceContextService);
      expect(context.editPeriod()).not.toBeNull();
      context.editPeriod()!();
      fixture.detectChanges();
      expect(q('app-evaluation-period-form')).not.toBeNull();
    });

    it('the period is not an action of the other roles, and without a period there is nothing to change: the banner gets no action', () => {
      setup('auditor', [framework()]);
      expect(TestBed.inject(ComplianceContextService).editPeriod()).toBeNull();
      TestBed.resetTestingModule();
      setup('admin_empresa', [undefinedFw()]);
      expect(TestBed.inject(ComplianceContextService).editPeriod()).toBeNull();
    });

    it('tells the banner the verdict of the framework (status and meaning), and takes it back when it closes', () => {
      setup('admin_empresa', [framework()]);
      const context = TestBed.inject(ComplianceContextService);
      expect(context.insight()).toEqual(jasmine.objectContaining({ kind: 'status' }));
      fixture.destroy();
      expect(context.insight()).toBeNull();
      expect(context.editPeriod()).toBeNull();
    });

    it('the evaluation counts as defined with a start and an end, even without a stored cutoff', () => {
      const view = setup('admin_empresa', [framework({ evaluation: { ...DEFINED, cutoff_date: null, cutoff_frozen: null } })]);
      expect(view.evaluationDefined()).toBeTrue();
    });

    it('once saved it closes the form, says so and asks for the summary again (the engine can measure now)', () => {
      const view = setup('admin_empresa', [undefinedFw()]);
      (q('[data-define-period]') as HTMLButtonElement).click();
      fixture.detectChanges();
      api.get.calls.reset();
      view.onPeriodSaved();
      fixture.detectChanges();
      expect(view.periodOpen()).toBeFalse();
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(q('[data-notice]')!.textContent).toContain('COMPLIANCE.PERIOD.SAVED');
    });
  });

  it('with several frameworks it tells the header they can be chosen there, and follows the choice', () => {
    const view = setup('admin_empresa', [framework(), framework({ framework_code: 'iso27001', name: 'ISO 27001', technical: technical('compliant') })]);
    const context = TestBed.inject(ComplianceContextService);
    expect(context.selectable()).toBeTrue();
    expect(context.selected()).toBe('soc2');
    context.headerShowsFrameworks.set(true);
    fixture.detectChanges();
    expect(el().querySelector('button[aria-pressed]')).toBeNull(); // el encabezado ya los muestra: aquí no se repiten
    context.selected.set('iso27001');
    fixture.detectChanges();
    expect(view.framework()!.framework_code).toBe('iso27001');
    expect(q('[data-verdict-title]')!.textContent).toContain('VERDICT.COMPLIANT');
  });

  it('leaves the header as it was when the tab is closed', () => {
    setup('admin_empresa', [framework(), framework({ framework_code: 'iso27001', name: 'ISO 27001' })]);
    const context = TestBed.inject(ComplianceContextService);
    expect(context.selectable()).toBeTrue();
    fixture.destroy();
    expect(context.selectable()).toBeFalse();
    expect(context.selected()).toBeNull();
    expect(context.evaluationText()).toBeNull();
  });

  it('derives the four counts: evaluated, effective, not effective and pending', () => {
    setup('admin_empresa', [framework({ progress: { done: 3, total: 10 }, coverage: { measured: 7, applicable: 10 }, technical: technical('non_compliant') })]);
    const kpi = (name: string) => q(`[data-kpi="${name}"]`)!.textContent!.replace(/\s/g, '');
    expect(kpi('evaluated')).toBe('7/10');
    expect(kpi('effective')).toBe('3');
    expect(kpi('ineffective')).toBe('4');
    expect(kpi('pending')).toBe('3');
  });

  it('lays the counts out as a header with the evaluated figure and a 3-column grid of aligned figures, each with its state dot and word', () => {
    setup('admin_empresa', [framework({ progress: { done: 3, total: 10 }, coverage: { measured: 7, applicable: 10 }, technical: technical('non_compliant') })]);
    const card = q('[data-kpis]')!;
    expect(card.querySelector('.grid-cols-3')!.className).toContain('tabular-nums');
    expect(card.querySelectorAll('.grid-cols-3 app-status-indicator').length).toBe(3);
    expect(Array.from(card.querySelectorAll('.grid-cols-3 app-status-indicator')).map((i) => i.getAttribute('data-tone'))).toEqual(['ok', 'bad', 'warn']);
    expect(card.textContent).toContain('COMPLIANCE.OVERVIEW.KPI_EVALUATED');
    expect(card.querySelector<HTMLElement>('[style*="width"]')!.style.width).toBe('70%');
  });

  it('shows one card per criterion with the names the backend serves', () => {
    setup('admin_empresa', [framework({ categories: [category('security'), category('availability', { readiness: 'ready', progress: { done: 4, total: 4 } })], technical: technical('non_compliant') })]);
    expect(q('[data-category="security"]')!.textContent).toContain('Seguridad');
    expect(q('[data-category="availability"]')!.textContent).toContain('Disponibilidad');
    expect(q('[data-category="availability"]')!.textContent).toContain('COMPLIANCE.OVERVIEW.CATEGORY_COUNT');
  });

  it('lists the controls that need attention with their code, where they fail and the affected asset; one row even if it fails in two criteria', () => {
    const shared = failing('k1', 'IAC-12', 'Gestión de accesos');
    setup('admin_empresa', [framework({ categories: [category('security', { failing_controls: [shared, failing('k2', 'MON-3', 'Monitoreo')] }), category('availability', { failing_controls: [shared] })], technical: technical('non_compliant') })]);
    const rows = Array.from(el().querySelectorAll('[data-attention] tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('IAC-12');
    expect(rows[0].textContent).toContain('Gestión de accesos');
    expect(rows[0].textContent).toContain('Seguridad');
    expect(rows[0].textContent).toContain('Disponibilidad');
    expect(rows[0].textContent).toContain('Nube');
    expect(rows[0].textContent).toContain('cuenta-aws-produccion');
  });

  it('adds the tests that pass of each failing control when the technical view brings them', () => {
    const security = category('security', {
      failing_controls: [failing('k1', 'IAC-12', 'Gestión de accesos')],
      technical: { state: 'non_compliant', controls: [{ control_id: 'k1', control_code: 'IAC-12', state: 'ineffective', progress: { done: 3, total: 4 }, blocking_tests: [] }] },
    });
    setup('admin_empresa', [framework({ categories: [security], technical: technical('non_compliant') })]);
    expect(q('[data-attention]')!.textContent).toContain('COMPLIANCE.OVERVIEW.TESTS');
  });

  it('shows the inherent matrix of the service with the risks that were evaluated', () => {
    const evaluated = { id: 'r1', code: 'R001', name: 'Acceso', trust_criterion: 'security', origin: 'catalog' as const, is_active: true, likelihood: 4, impact: 4, inherent_risk_value: 16, inherent_risk_level: 'high', treatment: null, causes_count: 1 };
    setup('admin_empresa', [framework({ technical: technical('non_compliant') })]);
    expect(q('[data-heatmap-empty]')).not.toBeNull(); // sin riesgos evaluados lo dice, no pinta una matriz verde
    riskApi.listAllRisks.and.returnValue(of([evaluated]));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(q('[data-heatmap-section]')).not.toBeNull();
    expect(q('[data-cell="4-4"]')!.getAttribute('data-count')).toBe('1');
    expect(riskApi.listAllRisks).toHaveBeenCalledWith('s1', 'technical');
  });

  it('says so when the service has no framework yet', () => {
    setup('admin_empresa', []);
    expect(q('[data-no-frameworks]')).not.toBeNull();
  });

  it('lets the user switch between the frameworks of the service', () => {
    const view = setup('admin_empresa', [framework(), framework({ framework_code: 'iso27001', name: 'ISO 27001', technical: technical('compliant') })]);
    expect(view.framework()!.framework_code).toBe('soc2');
    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['SOC 2', 'ISO 27001']);
    buttons[1].click();
    fixture.detectChanges();
    expect(view.framework()!.framework_code).toBe('iso27001');
  });

  it('shows an error with a retry when the summary cannot be loaded', () => {
    const view = setup('admin_empresa', [], 'error');
    expect(text()).toContain('COMPLIANCE.OVERVIEW.LOAD_ERROR_TITLE');
    api.get.and.returnValue(of({ service_id: 's1', frameworks: [framework()] }));
    view.load();
    fixture.detectChanges();
    expect(view.stage()).toBe('ready');
  });
});
