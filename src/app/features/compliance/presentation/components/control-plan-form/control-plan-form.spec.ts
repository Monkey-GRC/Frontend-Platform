import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { ControlPlanForm } from './control-plan-form';

describe('ControlPlanForm', () => {
  let fixture: ComponentFixture<ControlPlanForm>;
  let el: HTMLElement;

  beforeEach(() => {
    const api = { assignees: () => of([{ id: 'u1', name: 'Ana', last_name: 'Pérez', role: 'delegado' }]) };
    TestBed.configureTestingModule({ imports: [ControlPlanForm], providers: [provideTranslateService(), { provide: ControlManagementService, useValue: api }] });
    fixture = TestBed.createComponent(ControlPlanForm);
    fixture.componentRef.setInput('code', 'T-OPE-009');
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('asks for what, who and when, with an error each', () => {
    let sent = 0;
    fixture.componentInstance.submitted.subscribe(() => sent++);
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(sent).toBe(0);
    for (const key of ['ERR_WHAT', 'ERR_WHO', 'ERR_WHEN']) expect(el.textContent).toContain(`COMPLIANCE.APPROVAL.PLAN.${key}`);
  });

  it('sends the trimmed text, the owner and the date', () => {
    let sent: unknown;
    fixture.componentInstance.submitted.subscribe((v) => (sent = v));
    fixture.componentInstance.what.set(' Firmar el acta ');
    fixture.componentInstance.assignee.set('u1');
    fixture.componentInstance.due.set('2026-12-31');
    fixture.componentInstance.save();
    expect(sent).toEqual({ what: 'Firmar el acta', owner_id: 'u1', due_date: '2026-12-31' });
  });
});
