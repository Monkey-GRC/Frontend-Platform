import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ControlDetail } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ControlReturnForm } from './control-return-form';

const DETAIL = {
  id: 'c1', code: 'IAC-12',
  evidence: [{ requirement_id: 'r1', description: 'Acta del comité', responsible: null, latest_submission: { id: 'sub1', version: 2, evidence_state: 'current' } }, { requirement_id: 'r2', description: 'Sin entrega', responsible: null, latest_submission: null }],
} as unknown as ControlDetail;

describe('ControlReturnForm', () => {
  let api: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<ControlReturnForm>;
  let el: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['decide']);
    TestBed.configureTestingModule({ imports: [ControlReturnForm], providers: [provideTranslateService(), { provide: ControlService, useValue: api }] });
    fixture = TestBed.createComponent(ControlReturnForm);
    fixture.componentRef.setInput('detail', DETAIL);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('requires the reason and sends nothing without it', () => {
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(api.decide).not.toHaveBeenCalled();
    expect(el.textContent).toContain('COMPLIANCE.APPROVAL.RETURN.ERR_REASON');
  });

  it('offers only the control deliveries and sends the reason and the picked ones', () => {
    api.decide.and.returnValue(of({} as ControlDetail));
    expect(el.querySelectorAll('[data-submissions] input').length).toBe(1);
    let returned = 0;
    fixture.componentInstance.returned.subscribe(() => returned++);
    fixture.componentInstance.reason.set('  El acta no está firmada.  ');
    fixture.componentInstance.toggle('sub1', true);
    fixture.componentInstance.save();
    expect(api.decide).toHaveBeenCalledWith('c1', { decision: 'return', reason: 'El acta no está firmada.', returned_submission_ids: ['sub1'] }, undefined);
    expect(returned).toBe(1);
  });

  it('omits the submissions when none is picked and shows the text of a 409', () => {
    api.decide.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'NOTHING_TO_RETURN' } } })));
    let stale = 0;
    fixture.componentInstance.stale.subscribe(() => stale++);
    fixture.componentInstance.reason.set('Motivo');
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(api.decide.calls.mostRecent().args[1]).toEqual({ decision: 'return', reason: 'Motivo' });
    expect(el.querySelector('[data-banner]')?.textContent).toContain('COMPLIANCE.APPROVAL.ERR.NOTHING_TO_RETURN');
    expect(stale).toBe(1);
  });
});
