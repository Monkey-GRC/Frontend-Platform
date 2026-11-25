import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlDetail, ControlRequirement } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { provideCatalogStub } from '@shared/testing/catalog-options';
import { ControlPeriodicityForm } from './control-periodicity-form';

const req = (patch: Partial<ControlRequirement> = {}): ControlRequirement => ({
  id: 'r1', code: 'IAC-12-L2', text: 'x', type: 'operational', periodicity: 'quarterly', suggested_periodicity: 'quarterly', periodicity_source: 'catalog', status: 'compliant', tests: [], ...patch,
});
const detail = (requirements: ControlRequirement[] = [req()]): ControlDetail =>
  ({ id: 'c1', code: 'IAC-12', origin: 'catalog', technical: { points_of_focus: [], requirements } }) as unknown as ControlDetail;

describe('ControlPeriodicityForm', () => {
  let api: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<ControlPeriodicityForm>;

  function setup(d: ControlDetail = detail()): ControlPeriodicityForm {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['setPeriodicity']);
    api.setPeriodicity.and.returnValue(of(d));
    TestBed.configureTestingModule({ imports: [ControlPeriodicityForm], providers: [provideTranslateService(), provideCatalogStub(), { provide: ControlService, useValue: api }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlPeriodicityForm);
    fixture.componentRef.setInput('detail', d);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T | null;
  const saveButton = () => q<HTMLButtonElement>('[data-save]')!;
  const write = (text: string) => {
    const area = q<HTMLTextAreaElement>('textarea')!;
    area.value = text;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('shows the current and the suggested periodicity and warns that it applies to every requirement', () => {
    setup(detail([req({ periodicity: 'monthly', periodicity_source: 'client', suggested_periodicity: 'annual' })]));
    expect(q('[data-current]')!.textContent).toContain('monthly');
    expect(q('[data-suggested]')!.textContent).toContain('annual');
    expect(q('[data-scope-note]')!.textContent).toContain('COMPLIANCE.PERIODICITY_CHANGE.SCOPE_NOTE');
  });

  it('cannot be saved without choosing a different periodicity and writing a justification', () => {
    const form = setup();
    expect(saveButton().disabled).toBeTrue();
    form.pick('monthly');
    fixture.detectChanges();
    expect(saveButton().disabled).toBeTrue();
    write('   ');
    expect(saveButton().disabled).toBeTrue();
    write('Rotamos accesos cada mes.');
    expect(saveButton().disabled).toBeFalse();
  });

  it('sends the chosen periodicity with the trimmed justification, and emits the recalculated detail', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    form.pick('monthly');
    write('  Rotamos accesos cada mes.  ');
    saveButton().click();
    expect(api.setPeriodicity).toHaveBeenCalledOnceWith('c1', { periodicity: 'monthly', justification: 'Rotamos accesos cada mes.' }, 'technical');
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('«Usar la sugerida» sends null when the organization had changed it', () => {
    const form = setup(detail([req({ periodicity: 'monthly', periodicity_source: 'client', suggested_periodicity: 'quarterly' })]));
    form.pick('');
    write('Volvemos a lo del catálogo.');
    saveButton().click();
    expect(api.setPeriodicity.calls.mostRecent().args[1]).toEqual({ periodicity: null, justification: 'Volvemos a lo del catálogo.' });
  });

  it('warns when the justification is over 1000 characters and does not send', () => {
    const form = setup();
    form.pick('monthly');
    write('x'.repeat(1001));
    expect(q('[data-error="justification"]')!.textContent).toContain('COMPLIANCE.PERIODICITY_CHANGE.ERR_MAX');
    expect(saveButton().disabled).toBeTrue();
  });

  it('shows a 422 under its field and keeps the form open', () => {
    const form = setup();
    const saved = jasmine.createSpy('saved');
    form.saved.subscribe(saved);
    api.setPeriodicity.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { message: 'Revisa.', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'periodicity', code: 'periodicity.own_control', message: 'Un control propio no tiene periodicidad del catálogo.' }] } },
    })));
    form.pick('monthly');
    write('Motivo');
    saveButton().click();
    fixture.detectChanges();
    expect(q('[data-error="periodicity"]')!.textContent).toContain('Un control propio');
    expect(saved).not.toHaveBeenCalled();
  });

  it('shows a 409 CONTROL_RETIRED message in a banner', () => {
    const form = setup();
    api.setPeriodicity.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'El control ya estaba dado de baja.', error: { code: 'CONTROL_RETIRED' } } })));
    form.pick('monthly');
    write('Motivo');
    saveButton().click();
    fixture.detectChanges();
    expect(q('[data-banner]')!.textContent).toContain('El control ya estaba dado de baja.');
  });
});
