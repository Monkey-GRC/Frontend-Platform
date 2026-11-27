import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, defer, of, throwError } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { LABELS_RETRY_DELAY_MS } from '@shared/domain/services/management-labels.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ManualResultResponse } from '@features/compliance/domain/models/control.models';
import { ControlResultForm } from './control-result-form';

describe('ControlResultForm', () => {
  let api: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<ControlResultForm>;
  let el: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['registerResult']);
    const options = (name: string) => of(name === 'manual_test_result_value' ? [{ value: 'correct', label: 'Correcto' }, { value: 'observation', label: 'Observación' }, { value: 'exception', label: 'Excepción' }] : []);
    TestBed.configureTestingModule({ imports: [ControlResultForm], providers: [provideTranslateService(), { provide: ControlService, useValue: api }, { provide: CatalogService, useValue: { options } }] });
    fixture = TestBed.createComponent(ControlResultForm);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('testId', 't1');
    fixture.componentRef.setInput('testCode', 'T-OPE-001');
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('cannot be sent without a result', () => {
    fixture.componentInstance.save();
    expect(api.registerResult).not.toHaveBeenCalled();
  });

  it('sends a correct result without a note', () => {
    api.registerResult.and.returnValue(of({} as ManualResultResponse));
    let saved = 0;
    fixture.componentInstance.saved.subscribe(() => saved++);
    fixture.componentInstance.result.set('correct');
    fixture.componentInstance.save();
    expect(api.registerResult).toHaveBeenCalledWith('c1', 't1', { result: 'correct' });
    expect(saved).toBe(1);
  });

  it('requires the note for an observation and an exception', () => {
    for (const value of ['observation', 'exception']) {
      fixture.componentInstance.result.set(value);
      fixture.componentInstance.save();
      fixture.detectChanges();
      expect(api.registerResult).not.toHaveBeenCalled();
      expect(el.textContent).toContain('COMPLIANCE.APPROVAL.RESULT.ERR_NOTE');
    }
    fixture.componentInstance.note.set(' Falta una firma ');
    api.registerResult.and.returnValue(of({} as ManualResultResponse));
    fixture.componentInstance.save();
    expect(api.registerResult).toHaveBeenCalledWith('c1', 't1', { result: 'exception', note: 'Falta una firma' });
  });

  it('shows the text of TEST_NOT_MANUAL and stays open', () => {
    api.registerResult.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'TEST_NOT_MANUAL' } } })));
    fixture.componentInstance.result.set('correct');
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(el.querySelector('[data-banner]')?.textContent).toContain('COMPLIANCE.APPROVAL.ERR.TEST_NOT_MANUAL');
  });
});

describe('ControlResultForm options state', () => {
  function build(options: () => unknown): ComponentFixture<ControlResultForm> {
    TestBed.configureTestingModule({
      imports: [ControlResultForm],
      providers: [provideTranslateService(), { provide: LABELS_RETRY_DELAY_MS, useValue: 0 }, { provide: ControlService, useValue: {} }, { provide: CatalogService, useValue: { options } }],
    });
    const fixture = TestBed.createComponent(ControlResultForm);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('testId', 't1');
    fixture.componentRef.setInput('testCode', 'T-1');
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture;
  }

  it('shows no warning while the catalog loads, with the select disabled', () => {
    const fixture = build(() => NEVER);
    expect(fixture.componentInstance['optionsLoading']()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-options-error]')).toBeNull();
  });

  it('shows the warning only when the catalog failed', async () => {
    const fixture = build(() => defer(() => throwError(() => new Error('x'))));
    await new Promise((r) => setTimeout(r, 5));
    fixture.detectChanges();
    expect(fixture.componentInstance['optionsLoading']()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-options-error]')).not.toBeNull();
  });
});
