import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { RiskDetail, RiskEvaluationEntry, RiskListItem } from '@shared/domain/models/risk.models';
import { RiskService } from '@shared/domain/services/risk.service';
import { RISK_MATRIX, provideCatalogStub } from '@shared/testing/catalog-options';
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
    api = jasmine.createSpyObj<RiskService>('RiskService', ['listAllRisks', 'getRisk', 'evaluate', 'matrix', 'deactivateRisk', 'reactivateRisk', 'listAllCauses', 'linkCause', 'unlinkCause', 'getCause']);
    api.listAllCauses.and.returnValue(of([]));
    api.matrix.and.returnValue(of(RISK_MATRIX));
    api.listAllRisks.and.returnValue(of(risks));
    api.getRisk.and.callFake((id: string) => of(detailOf(risks.find((r) => r.id === id)!)));
    TestBed.configureTestingModule({ imports: [RiskWizard], providers: [provideTranslateService(), provideCatalogStub(), { provide: RiskService, useValue: api }] });
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

  it('puts «Anterior» to the left of «Guardar», and the removal next to the risk, away from the save buttons', () => {
    setup([done('r1', 'R001'), risk('r2', 'R002')]);
    const nav = q('[data-wizard-nav]')!;
    const back = nav.querySelector('[data-wizard-back]')!;
    const save = nav.querySelector('[data-wizard-save]')!;
    expect(back.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // Anterior va antes (a la izquierda) que Guardar
    const skip = q('[data-wizard-skip]')!;
    expect(q('[data-wizard-risk]')!.contains(skip)).toBeTrue(); // vive en la tarjeta del riesgo, a mano
    expect(q('[data-wizard-preview]')!.contains(skip)).toBeFalse(); // no está pegado a los botones de guardar
    expect(q('[data-wizard-risk]')!.compareDocumentPosition(q('[data-wizard-preview]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // y queda antes que la matriz
  });

  it('names what the risk belongs to: the criterion it affects and the losses it could cause', () => {
    setup(THREE);
    expect(q('[data-wizard-criterion]')!.textContent).toContain('security');
    expect(q('[data-wizard-belongs]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.CRITERION_LABEL');
    expect(q('[data-wizard-belongs]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.LOSSES_LABEL');
    expect(q('[data-wizard-losses]')!.textContent).toContain('reputational');
    expect(q('[data-wizard-belongs] .material-symbols-rounded')).toBeNull(); // sin íconos decorativos
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

  it('draws both scales without a status colour (only the chosen option stands out), and shows where the answer would land before saving', () => {
    setup(THREE);
    const tone = (question: 'likelihood' | 'impact', level: number) => q(`[data-wizard-${question}] [data-level="${level}"]`)!.className;
    for (const level of [1, 3, 5]) expect(tone('likelihood', level)).not.toMatch(/green|red|yellow|orange|lime|risk-/);
    expect(tone('likelihood', 1)).toBe(tone('likelihood', 5));
    expect(q('[data-wizard-value]')).toBeNull(); // sin las dos respuestas no hay nivel que mostrar
    choose('likelihood', 4);
    choose('impact', 4);
    expect(q('[data-wizard-value]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.RESULT_VALUE');
    expect(q('[data-wizard-preview] app-risk-level-badge [data-level]')!.getAttribute('data-level')).toBe('high'); // 4 × 4 = 16
    expect(tone('likelihood', 4)).toContain('ring-2'); // la elegida se marca
  });

  it('paints one chip per risk in the strip, and jumps to a risk when its chip is pressed', () => {
    const wizard = setup(THREE);
    expect(el().querySelectorAll('[data-wizard-stepper] [data-step]').length).toBe(3);
    q<HTMLButtonElement>('[data-step="2"]')!.click();
    fixture.detectChanges();
    expect(wizard.current()!.code).toBe('R010');
  });

  describe('retiring a risk that does not apply (D93)', () => {
    const open = () => {
      q<HTMLButtonElement>('[data-wizard-skip]')!.click();
      fixture.detectChanges();
    };
    const write = (text: string) => {
      const box = q<HTMLTextAreaElement>('[data-wizard-reason]')!;
      box.value = text;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const confirm = () => {
      q<HTMLButtonElement>('[data-wizard-remove-confirm]')!.click();
      fixture.detectChanges();
    };

    it('asks why first, and does not let it be removed without a reason', () => {
      setup(THREE);
      expect(q('[data-wizard-remove]')).toBeNull();
      open();
      expect(q('[data-wizard-remove]')).not.toBeNull();
      expect(q<HTMLButtonElement>('[data-wizard-remove-confirm]')!.disabled).toBeTrue();
      write('  ab ');
      expect(q<HTMLButtonElement>('[data-wizard-remove-confirm]')!.disabled).toBeTrue();
      write('No usamos portátiles');
      expect(q<HTMLButtonElement>('[data-wizard-remove-confirm]')!.disabled).toBeFalse();
    });

    it('sends the reason, takes the risk out of the pending ones and moves on to the next', () => {
      const wizard = setup(THREE);
      api.deactivateRisk.and.returnValue(of(undefined));
      open();
      write('  No usamos portátiles  ');
      confirm();
      expect(api.deactivateRisk).toHaveBeenCalledOnceWith('r2', 'No usamos portátiles');
      expect(wizard.risks().map((r) => r.code)).toEqual(['R001', 'R010']);
      expect(wizard.current()!.code).toBe('R010');
      expect(wizard.progress()).toEqual(jasmine.objectContaining({ total: 2, evaluated: 1, pending: 1 }));
      expect(wizard.removedCount()).toBe(1);
      expect(q('[data-wizard-remove]')).toBeNull(); // el siguiente riesgo empieza sin el cuadro abierto
    });

    it('finishes when the risk removed was the last one missing, and says how many were removed', () => {
      const wizard = setup([done('r1', 'R001'), risk('r2', 'R002')]);
      api.deactivateRisk.and.returnValue(of(undefined));
      open();
      write('No aplica a este servicio');
      confirm();
      expect(wizard.stage()).toBe('done');
      expect(q('[data-wizard-removed]')!.textContent).toContain('COMPLIANCE.RISK_WIZARD.DONE_REMOVED');
    });

    it('keeps the risk and shows the message of the server when it cannot be removed, and lets the person cancel', () => {
      const wizard = setup(THREE);
      api.deactivateRisk.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Solo el administrador puede retirarlo.', error: { code: 'FORBIDDEN' } } })));
      open();
      write('No aplica');
      confirm();
      expect(wizard.current()!.code).toBe('R002');
      expect(wizard.removeError()).toBe('Solo el administrador puede retirarlo.');
      q<HTMLButtonElement>('[data-testid="wizard-remove-cancel"]')!.click();
      fixture.detectChanges();
      // MD-485 · Hay un motivo escrito: antes de descartarlo se pide confirmar.
      const discard = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
      expect(discard).not.toBeNull();
      discard.querySelector<HTMLButtonElement>('[data-confirm]')!.click();
      fixture.detectChanges();
      expect(q('[data-wizard-remove]')).toBeNull();
      expect(wizard.removedCount()).toBe(0);
    });
  });
  describe('adding a risk and bringing back a removed one (D93)', () => {
    const gone = risk('r9', 'R009', { is_active: false });

    it('lists the removed risks with a button to include them again, and shows the risk once it is back', () => {
      const wizard = setup([...THREE, gone]);
      expect(api.listAllRisks).toHaveBeenCalledWith('s1', undefined, true); // incluye los retirados
      expect(wizard.risks().map((r) => r.code)).toEqual(['R001', 'R002', 'R010']);
      expect(wizard.removed().map((r) => r.code)).toEqual(['R009']);
      api.reactivateRisk.and.returnValue(of(detailOf(risk('r9', 'R009'))));
      api.listAllRisks.and.returnValue(of([...THREE, risk('r9', 'R009')]));
      api.getRisk.and.returnValue(of(detailOf(risk('r9', 'R009'))));
      q<HTMLButtonElement>('[data-restore="r9"]')!.click();
      fixture.detectChanges();
      expect(api.reactivateRisk).toHaveBeenCalledOnceWith('r9');
      expect(wizard.removed()).toEqual([]);
      expect(wizard.current()!.code).toBe('R009'); // el asistente lo muestra para calificarlo
    });

    it('opens the form to add a risk, and after saving it goes on to choose its causes', () => {
      const wizard = setup(THREE);
      q<HTMLButtonElement>('[data-wizard-add]')!.click();
      fixture.detectChanges();
      expect(q('app-risk-form')).not.toBeNull();
      api.listAllRisks.and.returnValue(of([...THREE, risk('r11', 'R011', { origin: 'own' })]));
      api.getRisk.and.returnValue(of(detailOf(risk('r11', 'R011', { origin: 'own' }))));
      wizard.onRiskCreated('r11');
      fixture.detectChanges();
      expect(wizard.stage()).toBe('causes');
      expect(q('app-risk-form')).toBeNull();
      expect(q('[data-causes-picker]')).not.toBeNull();
      q<HTMLButtonElement>('[data-causes-done]')!.click();
      fixture.detectChanges();
      expect(wizard.stage()).toBe('ready');
      expect(wizard.current()!.code).toBe('R011'); // el riesgo nuevo queda por calificar
    });
  });
  it('shows who can evaluate, instead of the questions, to a role that cannot', () => {
    setup(THREE, 'auditor');
    expect(q('[data-wizard-readonly]')).not.toBeNull();
    expect(q('[data-wizard-save]')).toBeNull();
  });
});
