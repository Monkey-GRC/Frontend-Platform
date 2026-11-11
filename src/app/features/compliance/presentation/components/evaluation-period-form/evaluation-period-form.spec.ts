import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { EvaluationPeriodForm } from './evaluation-period-form';

const TODAY = new Date().toISOString().slice(0, 10);
const UNDEFINED = { catalog_version: null, period_start: null, period_end: null, cutoff_date: null, cutoff_frozen: null };
const framework = (evaluation: OverviewFramework['evaluation'] = UNDEFINED): OverviewFramework => ({
  framework_code: 'soc2', name: 'SOC 2', readiness: 'not_measured', progress: { done: 0, total: 5 }, coverage: { measured: 0, applicable: 5 }, evaluation, categories: [],
});
const RESULT = { framework_code: 'soc2', catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: TODAY, cutoff_frozen: false };

// D105 · Las fechas del período se eligen en un calendario y no hay fecha de corte que elegir ni congelar: se mide siempre con lo último que revisó la evaluación automática.
describe('EvaluationPeriodForm', () => {
  let api: jasmine.SpyObj<OverviewService>;
  let fixture: ComponentFixture<EvaluationPeriodForm>;

  function setup(fw: OverviewFramework = framework()): EvaluationPeriodForm {
    api = jasmine.createSpyObj<OverviewService>('OverviewService', ['setEvaluationPeriod']);
    api.setEvaluationPeriod.and.returnValue(of(RESULT));
    TestBed.configureTestingModule({ imports: [EvaluationPeriodForm], providers: [provideTranslateService(), { provide: OverviewService, useValue: api }] });
    fixture = TestBed.createComponent(EvaluationPeriodForm);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.componentRef.setInput('framework', fw);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector(selector) as T | null;
  /** Elegir un día en el calendario deja el valor en el campo; aquí se pone directo, porque cómo se elige ya lo prueba el selector de fechas. */
  const pick = (field: 'start' | 'end', value: string) => {
    const form = fixture.componentInstance;
    (field === 'start' ? form.start : form.end).set(value);
    fixture.detectChanges();
  };
  const saveButton = () => q<HTMLButtonElement>('[data-save]')!;

  it('opens empty when the framework has no period', () => {
    const form = setup();
    expect(form.start()).toBe('');
    expect(form.end()).toBe('');
    expect(saveButton().disabled).toBeTrue();
  });

  it('chooses the dates in a calendar, and offers nothing about a cutoff date', () => {
    setup();
    expect(el().querySelectorAll('app-date-picker').length).toBe(2);
    expect(el().querySelectorAll('input[type="date"]').length).toBe(0);
    expect(q('[data-field="freeze"]')).toBeNull();
    expect(q('[data-field="cutoff"]')).toBeNull();
    expect(el().textContent).not.toContain('CUTOFF');
    expect(el().textContent).not.toContain('FREEZE');
  });

  it('opens with what the framework already has', () => {
    const form = setup(framework({ catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: '2026-10-14', cutoff_frozen: false }));
    expect([form.start(), form.end()]).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('saves the period with no cutoff, so the cutoff is always «today»', () => {
    setup();
    pick('start', '2026-01-01');
    pick('end', '2026-12-31');
    expect(saveButton().disabled).toBeFalse();
    saveButton().click();
    expect(api.setEvaluationPeriod).toHaveBeenCalledOnceWith('s1', 'soc2', { period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: null });
  });

  it('never sends a cutoff, even if the framework still had one frozen from before: saving the period unfreezes it', () => {
    setup(framework({ catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: '2026-10-14', cutoff_frozen: true }));
    saveButton().click();
    expect(api.setEvaluationPeriod.calls.mostRecent().args[2].cutoff_date).toBeNull();
  });

  it('accepts a single-day period (SOC 2 Type I)', () => {
    setup();
    pick('start', '2026-10-15');
    pick('end', '2026-10-15');
    expect(q('[data-error="period_end"]')).toBeNull();
    expect(saveButton().disabled).toBeFalse();
  });

  it('warns, before asking the server, when the end is before the start, and does not send', () => {
    setup();
    pick('start', '2026-12-31');
    pick('end', '2026-01-01');
    expect(q('[data-error="period_end"]')!.textContent).toContain('COMPLIANCE.PERIOD.ERR_RANGE');
    expect(saveButton().disabled).toBeTrue();
    saveButton().click();
    expect(api.setEvaluationPeriod).not.toHaveBeenCalled();
  });

  it('tells the owner it was saved', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    pick('start', '2026-01-01');
    pick('end', '2026-12-31');
    saveButton().click();
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the field errors the server sends (422), already translated, and does not close', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    api.setEvaluationPeriod.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { message: 'Revisa los datos enviados.', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'period_start', code: 'date.invalid', message: 'Esa fecha no es válida.' }] } },
    })));
    pick('start', '2026-01-01');
    pick('end', '2026-12-31');
    saveButton().click();
    fixture.detectChanges();
    expect(q('[data-error="period_start"]')!.textContent).toContain('Esa fecha no es válida.');
    expect(saved).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBeFalse();
  });

  it('shows the message of any other failure in a banner (for example a 404 for a framework that is not contracted)', () => {
    setup();
    api.setEvaluationPeriod.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No encontramos lo que buscas.' } })));
    pick('start', '2026-01-01');
    pick('end', '2026-12-31');
    saveButton().click();
    fixture.detectChanges();
    expect(q('[data-banner]')!.textContent).toContain('No encontramos lo que buscas.');
  });

  it('cancel only closes', () => {
    const form = setup();
    const closed = jasmine.createSpy('closed');
    form.closed.subscribe(closed);
    q<HTMLButtonElement>('[data-cancel]')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(api.setEvaluationPeriod).not.toHaveBeenCalled();
  });
});
