import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { OverviewFramework } from '../../../domain/models/overview.models';
import { OverviewService } from '../../../domain/services/overview.service';
import { EvaluationPeriodForm } from './evaluation-period-form';

const TODAY = new Date().toISOString().slice(0, 10);
const UNDEFINED = { catalog_version: null, period_start: null, period_end: null, cutoff_date: null, cutoff_frozen: null };
const framework = (evaluation: OverviewFramework['evaluation'] = UNDEFINED): OverviewFramework => ({
  framework_code: 'soc2', name: 'SOC 2', readiness: 'not_measured', progress: { done: 0, total: 5 }, coverage: { measured: 0, applicable: 5 }, evaluation, categories: [],
});
const RESULT = { framework_code: 'soc2', catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: TODAY, cutoff_frozen: false };

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
  const type = (field: string, value: string) => {
    const input = q<HTMLInputElement>(`[data-field="${field}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const toggleFreeze = (on: boolean) => {
    const box = q<HTMLInputElement>('[data-field="freeze"]')!;
    box.checked = on;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const saveButton = () => q<HTMLButtonElement>('[data-save]')!;

  it('opens empty when the framework has no period, with the cutoff not frozen', () => {
    const form = setup();
    expect(form.start()).toBe('');
    expect(form.end()).toBe('');
    expect(form.freeze()).toBeFalse();
    expect(q('[data-field="cutoff"]')).toBeNull();
    expect(saveButton().disabled).toBeTrue();
  });

  it('opens with what the framework already has, and a frozen cutoff comes back frozen', () => {
    const form = setup(framework({ catalog_version: '3', period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: '2026-10-14', cutoff_frozen: true }));
    expect([form.start(), form.end(), form.freeze(), form.cutoff()]).toEqual(['2026-01-01', '2026-12-31', true, '2026-10-14']);
    expect(q<HTMLInputElement>('[data-field="cutoff"]')!.value).toBe('2026-10-14');
  });

  it('saves the period with no cutoff by default, so the cutoff is «today»', () => {
    setup();
    type('start', '2026-01-01');
    type('end', '2026-12-31');
    expect(saveButton().disabled).toBeFalse();
    saveButton().click();
    expect(api.setEvaluationPeriod).toHaveBeenCalledOnceWith('s1', 'soc2', { period_start: '2026-01-01', period_end: '2026-12-31', cutoff_date: null });
  });

  it('freezes the cutoff only when asked, and unfreezing sends null again', () => {
    setup();
    type('start', '2026-01-01');
    type('end', '2030-12-31');
    toggleFreeze(true);
    type('cutoff', TODAY);
    saveButton().click();
    expect(api.setEvaluationPeriod.calls.mostRecent().args[2].cutoff_date).toBe(TODAY);
    toggleFreeze(false);
    saveButton().click();
    expect(api.setEvaluationPeriod.calls.mostRecent().args[2].cutoff_date).toBeNull();
  });

  it('accepts a single-day period (SOC 2 Type I)', () => {
    setup();
    type('start', '2026-10-15');
    type('end', '2026-10-15');
    expect(q('[data-error="period_end"]')).toBeNull();
    expect(saveButton().disabled).toBeFalse();
  });

  it('warns, before asking the server, when the end is before the start, and does not send', () => {
    setup();
    type('start', '2026-12-31');
    type('end', '2026-01-01');
    expect(q('[data-error="period_end"]')!.textContent).toContain('COMPLIANCE.PERIOD.ERR_RANGE');
    expect(saveButton().disabled).toBeTrue();
    saveButton().click();
    expect(api.setEvaluationPeriod).not.toHaveBeenCalled();
  });

  it('warns about a frozen cutoff outside the period, in the future, or missing', () => {
    setup();
    type('start', '2020-01-01');
    type('end', '2020-12-31');
    toggleFreeze(true);
    type('cutoff', TODAY);
    expect(q('[data-error="cutoff_date"]')!.textContent).toContain('ERR_CUTOFF_OUT');
    type('end', '2999-12-31');
    type('cutoff', '2999-01-01');
    expect(q('[data-error="cutoff_date"]')!.textContent).toContain('ERR_CUTOFF_FUTURE');
    type('cutoff', '');
    expect(q('[data-error="cutoff_date"]')!.textContent).toContain('ERR_CUTOFF_REQUIRED');
    expect(saveButton().disabled).toBeTrue();
  });

  it('tells the owner it was saved', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    type('start', '2026-01-01');
    type('end', '2026-12-31');
    saveButton().click();
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the field errors the server sends (422), already translated, and does not close', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    api.setEvaluationPeriod.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { message: 'Revisa los datos enviados.', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'period_start', code: 'date.invalid', message: 'Escribe la fecha con el formato AAAA-MM-DD.' }] } },
    })));
    type('start', '2026-01-01');
    type('end', '2026-12-31');
    saveButton().click();
    fixture.detectChanges();
    expect(q('[data-error="period_start"]')!.textContent).toContain('Escribe la fecha con el formato AAAA-MM-DD.');
    expect(saved).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBeFalse();
  });

  it('shows the message of any other failure in a banner (for example a 404 for a framework that is not contracted)', () => {
    setup();
    api.setEvaluationPeriod.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No encontramos lo que buscas.' } })));
    type('start', '2026-01-01');
    type('end', '2026-12-31');
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
