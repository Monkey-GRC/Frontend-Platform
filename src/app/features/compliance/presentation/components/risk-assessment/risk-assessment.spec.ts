import { COMPLIANCE_OPTIONS, RISK_MATRIX, provideCatalogStub } from '../../../testing/catalog-options';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Responsible, RiskDetail, RiskEvaluationEntry, RiskTreatmentRecord } from '../../../domain/models/risk.models';
import { ResponsibleService } from '../../../domain/services/responsible.service';
import { RiskService } from '../../../domain/services/risk.service';
import { RiskAssessment } from './risk-assessment';

const RISK: RiskDetail = {
  id: 'r1', service_id: 's1', code: 'R001', name: 'Acceso no autorizado', description: '', trust_criterion: 'confidentiality', potential_impact: [], origin: 'catalog', is_active: true,
  likelihood: null, impact: null, inherent_risk_value: null, inherent_risk_level: null, treatment: null, causes: [],
};
const EVALUATED: RiskDetail = { ...RISK, likelihood: 3, impact: 4, inherent_risk_value: 12, inherent_risk_level: 'high' };
const TREATED: RiskDetail = { ...EVALUATED, treatment: { decision: 'mitigate', due_date: '2026-12-15', responsible: { id: 'p1', type: 'ciso', person_name: 'Marta Ruiz' } } };

const CISO: Responsible = { id: 'p1', type: 'ciso', person_name: 'Marta Ruiz', is_in_use: false };
const entry = (likelihood: number, impact: number, previous: RiskEvaluationEntry['previous'] = null): RiskEvaluationEntry => ({
  risk_id: 'r1', likelihood, impact, inherent_risk_value: likelihood * impact, inherent_risk_level: 'high', previous,
  evaluated_by: { id: 'u1', name: 'Laura', last_name: 'Gómez' }, evaluated_at: '2026-10-14T16:20:05Z',
});
const record: RiskTreatmentRecord = { id: 't1', risk_id: 'r1', decision: 'mitigate', responsible: { id: 'p1', type: 'ciso', person_name: 'Marta Ruiz' }, due_date: '2026-12-15', created_at: '2026-10-14T16:31:40Z' };

describe('RiskAssessment', () => {
  let api: jasmine.SpyObj<RiskService>;
  let responsibles: jasmine.SpyObj<ResponsibleService>;
  let fixture: ComponentFixture<RiskAssessment>;
  let changed: number;

  function setup(risk: RiskDetail, canManage = true): RiskAssessment {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['evaluate', 'evaluationHistory', 'createTreatment', 'matrix']);
    api.matrix.and.returnValue(of(RISK_MATRIX));
    responsibles = jasmine.createSpyObj<ResponsibleService>('ResponsibleService', ['list']);
    responsibles.list.and.returnValue(of([CISO]));
    TestBed.configureTestingModule({
      imports: [RiskAssessment],
      providers: [provideCatalogStub(), provideTranslateService({ fallbackLang: 'es' }), { provide: RiskService, useValue: api }, { provide: ResponsibleService, useValue: responsibles }],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { COMPLIANCE: { TREATMENT_DECISION: { MITIGATE: 'Mitigar' }, RESPONSIBLE_TYPE: { CISO: 'CISO' }, RISK_LEVEL: { HIGH: 'Alto' } } });
    translate.use('es');
    fixture = TestBed.createComponent(RiskAssessment);
    fixture.componentRef.setInput('risk', risk);
    fixture.componentRef.setInput('canManage', canManage);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const pick = (selector: string, value: string) => {
    const select = el().querySelector<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const click = (selector: string) => {
    el().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  it('says a risk has not been evaluated and has no treatment yet', () => {
    setup(RISK);
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.NOT_EVALUATED');
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.TREATMENT_NONE');
  });

  it('shows the score the server calculated and the current treatment with its responsible and due date', () => {
    setup(TREATED);
    expect(el().querySelector('[data-test-score]')!.textContent).toContain('COMPLIANCE.RISK_ASSESSMENT.SCORE');
    const treatment = el().querySelector('[data-test-treatment]')!.textContent ?? '';
    expect(treatment).toContain('Mitigar');
    expect(treatment).toContain('CISO');
    expect(treatment).toContain('Marta Ruiz');
  });

  it('offers to evaluate and to treat only to the company admin', () => {
    setup(RISK, true);
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.EVALUATE');
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.DEFINE_TREATMENT');
    TestBed.resetTestingModule();
    setup(RISK, false);
    expect(text()).not.toContain('COMPLIANCE.RISK_ASSESSMENT.EVALUATE');
    expect(text()).not.toContain('COMPLIANCE.RISK_ASSESSMENT.DEFINE_TREATMENT');
  });

  it('sends the likelihood and the impact chosen from 1 to 5 and tells the panel the risk changed', () => {
    setup(RISK);
    api.evaluate.and.returnValue(of(entry(3, 4)));
    click('[data-test-start-evaluation]');
    expect(el().querySelector<HTMLButtonElement>('[data-test-save-evaluation]')!.disabled).toBeTrue();
    expect(el().querySelector('[data-test-picked]')!.textContent).toContain('COMPLIANCE.RISK_ASSESSMENT.PICK_PROMPT');
    click('[data-cell="3-4"]');
    expect(el().querySelector('[data-test-picked]')!.textContent).toContain('COMPLIANCE.RISK_ASSESSMENT.PICKED');
    expect(el().querySelector<HTMLButtonElement>('[data-test-save-evaluation]')!.disabled).toBeFalse();
    click('[data-test-save-evaluation]');
    expect(api.evaluate).toHaveBeenCalledOnceWith('r1', 3, 4);
    expect(changed).toBe(1);
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.EVALUATED');
  });

  it('shows where an evaluated risk falls on the matrix, painted with the level the server returned', () => {
    setup(EVALUATED);
    const cell = el().querySelector('[data-test-position] [data-cell="3-4"]')!;
    expect(cell.getAttribute('aria-current')).toBe('true');
    expect(cell.className).toContain('bg-orange-600'); // el nivel Alto, con el tono intenso de la casilla guardada
    expect(el().querySelectorAll('[data-test-position] [data-cell][aria-current="true"]').length).toBe(1);
  });

  it('does not show a position for a risk that has not been evaluated', () => {
    setup(RISK);
    expect(el().querySelector('[data-test-position]')).toBeNull();
  });

  it('starts the form on the saved cell when evaluating again, so a small change is one click away', () => {
    setup(EVALUATED);
    click('[data-test-start-evaluation]');
    expect(el().querySelector('[data-test-picked]')!.textContent).toContain('COMPLIANCE.RISK_ASSESSMENT.PICKED');
    expect(el().querySelector('[data-cell="3-4"]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('offers the treatment decisions that the backend serves', () => {
    setup(EVALUATED);
    click('[data-test-start-treatment]');
    const options = Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-decision] option')).map((o) => o.value).filter(Boolean);
    expect(options).toEqual(COMPLIANCE_OPTIONS['risk_treatment_decision'].map((o) => o.value));
  });

  it('shows the message of the server when the evaluation is refused', () => {
    setup(RISK);
    api.evaluate.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Este riesgo está dado de baja.' } })));
    click('[data-test-start-evaluation]');
    click('[data-cell="2-2"]');
    click('[data-test-save-evaluation]');
    expect(text()).toContain('Este riesgo está dado de baja.');
    expect(changed).toBe(0);
  });

  it('loads the evaluation history only when it is opened, newest first, with who evaluated and the previous value', () => {
    setup(EVALUATED);
    api.evaluationHistory.and.returnValue(of([entry(3, 4, { likelihood: 2, impact: 4, inherent_risk_value: 8, inherent_risk_level: 'moderate' })]));
    expect(api.evaluationHistory).not.toHaveBeenCalled();
    click('[data-test-history-toggle]');
    expect(api.evaluationHistory).toHaveBeenCalledOnceWith('r1');
    const history = el().querySelector('[data-test-history]')!.textContent ?? '';
    expect(history).toContain('Laura Gómez');
    expect(history).toContain('COMPLIANCE.RISK_ASSESSMENT.HISTORY_BEFORE');
  });

  it('says the history could not be read instead of failing', () => {
    setup(EVALUATED);
    api.evaluationHistory.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    click('[data-test-history-toggle]');
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.HISTORY_ERROR');
  });

  it('records the treatment with the decision, the responsible role and a due date not in the past', () => {
    const view = setup(EVALUATED);
    api.createTreatment.and.returnValue(of(record));
    click('[data-test-start-treatment]');
    expect(responsibles.list).toHaveBeenCalled();
    expect(el().querySelector<HTMLInputElement>('[data-test-due-date]')!.min).toBe(view.today);
    expect(el().querySelector<HTMLButtonElement>('[data-test-save-treatment]')!.disabled).toBeTrue();
    pick('[data-test-decision]', 'mitigate');
    pick('[data-test-responsible]', 'p1');
    const date = el().querySelector<HTMLInputElement>('[data-test-due-date]')!;
    date.value = '2099-12-15';
    date.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('[data-test-save-treatment]');
    expect(api.createTreatment).toHaveBeenCalledOnceWith('r1', { decision: 'mitigate', responsible_id: 'p1', due_date: '2099-12-15' });
    expect(changed).toBe(1);
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.TREATED');
  });

  it('asks to create a responsible role first when the organization has none', () => {
    setup(EVALUATED);
    responsibles.list.and.returnValue(of([]));
    click('[data-test-start-treatment]');
    expect(el().querySelector('[data-test-no-responsibles]')).not.toBeNull();
    expect(el().querySelector('[data-test-save-treatment]')).toBeNull();
  });
});
