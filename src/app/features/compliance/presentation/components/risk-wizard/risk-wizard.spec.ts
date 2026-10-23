import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { RiskDetail, RiskEvaluationEntry, RiskListItem } from '../../../domain/models/risk.models';
import { RiskService } from '../../../domain/services/risk.service';
import { RiskWizard } from './risk-wizard';

const risk = (id: string, code: string, patch: Partial<RiskListItem> = {}): RiskListItem => ({
  id, code, name: `Riesgo ${code}`, trust_criterion: 'security', origin: 'catalog', is_active: true, likelihood: null, impact: null, inherent_risk_value: null, inherent_risk_level: null, treatment: null, causes_count: 1, ...patch,
});
const done = (id: string, code: string) => risk(id, code, { likelihood: 3, impact: 3, inherent_risk_value: 9, inherent_risk_level: 'moderate' });
const detailOf = (r: RiskListItem): RiskDetail => ({ ...r, service_id: 's1', description: `Qué es ${r.code}`, potential_impact: ['reputational'], causes: [] }) as RiskDetail;
const score = (id: string, likelihood: number, impact: number): RiskEvaluationEntry =>
  ({ risk_id: id, likelihood, impact, inherent_risk_value: likelihood * impact, inherent_risk_level: 'high', previous: null, evaluated_by: null, evaluated_at: '2026-10-23T12:00:00Z' }) as RiskEvaluationEntry;

// D89 · El asistente del alta del servicio: un riesgo a la vez, dos preguntas de 1 a 5, y al terminar invita a declarar los activos.
describe('RiskWizard (D89)', () => {
  let api: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<RiskWizard>;

  function setup(risks: RiskListItem[], role = 'admin_empresa'): RiskWizard {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['listAllRisks', 'getRisk', 'evaluate']);
    api.listAllRisks.and.returnValue(of(risks));
    api.getRisk.and.callFake((id: string) => of(detailOf(risks.find((r) => r.id === id)!)));
    TestBed.configureTestingModule({ imports: [RiskWizard], providers: [provideTranslateService(), { provide: RiskService, useValue: api }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(RiskWizard);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends Element>(s: string) => el().querySelector<T>(s);
  const choose = (question: 'likelihood' | 'impact', level: number) => {
    q<HTMLButtonElement>(`[data-wizard-${question}] [data-level="${level}"]`)!.click();
    fixture.detectChanges();
  };
  const save = () => {
    q<HTMLButtonElement>('[data-wizard-save]')!.click();
    fixture.detectChanges();
  };

  const THREE = [done('r1', 'R001'), risk('r2', 'R002'), risk('r3', 'R010')];

  it('starts at the first risk without an evaluation, so a person can resume where they left', () => {
    const wizard = setup(THREE);
    expect(wizard.current()!.code).toBe('R002');
    expect(q('[data-wizard-position]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.POSITION');
    expect(q('[data-wizard-risk]')!.textContent).toContain('Riesgo R002');
    expect(q('[data-wizard-risk]')!.textContent).toContain('Qué es R002'); // la descripción del riesgo
  });

  it('asks two questions with five levels each, and starts with no answer chosen', () => {
    const wizard = setup(THREE);
    expect(el().querySelectorAll('[data-wizard-likelihood] [data-level]').length).toBe(5);
    expect(el().querySelectorAll('[data-wizard-impact] [data-level]').length).toBe(5);
    expect(wizard.likelihood()).toBeNull();
    expect(wizard.impact()).toBeNull();
    expect(q<HTMLButtonElement>('[data-wizard-save]')!.disabled).toBeTrue();
  });

  it('only lets save when both questions are answered, and sends them to the server as probability and impact', () => {
    setup(THREE);
    api.evaluate.and.returnValue(of(score('r2', 4, 2)));
    choose('likelihood', 4);
    expect(q<HTMLButtonElement>('[data-wizard-save]')!.disabled).toBeTrue();
    choose('impact', 2);
    expect(q<HTMLButtonElement>('[data-wizard-save]')!.disabled).toBeFalse();
    expect(q('[data-wizard-likelihood] [data-level="4"]')!.getAttribute('aria-checked')).toBe('true');
    save();
    expect(api.evaluate).toHaveBeenCalledOnceWith('r2', 4, 2);
  });

  it('moves on to the next risk without an evaluation after saving, with its questions empty again', () => {
    const wizard = setup(THREE);
    api.evaluate.and.returnValue(of(score('r2', 4, 2)));
    choose('likelihood', 4);
    choose('impact', 2);
    save();
    expect(wizard.current()!.code).toBe('R010');
    expect(wizard.likelihood()).toBeNull();
    expect(wizard.progress()).toEqual(jasmine.objectContaining({ evaluated: 2, pending: 1 }));
  });

  it('offers to finish when the last missing risk is saved, then invites to declare the assets', () => {
    const wizard = setup([done('r1', 'R001'), risk('r2', 'R002')]);
    expect(el().querySelector('[data-wizard-save]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.SAVE_LAST');
    api.evaluate.and.returnValue(of(score('r2', 5, 5)));
    choose('likelihood', 5);
    choose('impact', 5);
    save();
    expect(wizard.stage()).toBe('done');
    expect(q('[data-wizard-done]')).not.toBeNull();
    let finished = 0;
    wizard.finished.subscribe(() => finished++);
    q<HTMLButtonElement>('[data-wizard-finish]')!.click();
    expect(finished).toBe(1);
  });

  it('goes straight to the end when every risk already has its evaluation, and when the service has no active risks', () => {
    expect(setup([done('r1', 'R001'), done('r2', 'R002')]).stage()).toBe('done');
    TestBed.resetTestingModule();
    expect(setup([risk('r1', 'R001', { is_active: false })]).stage()).toBe('done');
  });

  it('lets the person go back to a previous risk and shows what was answered there', () => {
    const wizard = setup([done('r1', 'R001'), risk('r2', 'R002')]);
    q<HTMLButtonElement>('[data-wizard-back]')!.click();
    fixture.detectChanges();
    expect(wizard.current()!.code).toBe('R001');
    expect(wizard.likelihood()).toBe(3);
    expect(wizard.impact()).toBe(3);
  });

  it('keeps the same risk and shows the message of the server when saving fails', () => {
    const wizard = setup(THREE);
    api.evaluate.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'La probabilidad debe estar entre 1 y 5.', error: { code: 'VALIDATION_FAILED' } } })));
    choose('likelihood', 4);
    choose('impact', 2);
    save();
    expect(wizard.current()!.code).toBe('R002');
    expect(wizard.error()).toBe('La probabilidad debe estar entre 1 y 5.');
    expect(wizard.likelihood()).toBe(4); // lo que respondió no se pierde
  });

  it('shows who can evaluate, instead of the questions, to a role that cannot', () => {
    setup(THREE, 'auditor');
    expect(q('[data-wizard-readonly]')).not.toBeNull();
    expect(q('[data-wizard-save]')).toBeNull();
  });
});
