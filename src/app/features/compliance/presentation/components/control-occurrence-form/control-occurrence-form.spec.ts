import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ControlOccurrenceForm } from './control-occurrence-form';

describe('ControlOccurrenceForm', () => {
  let fixture: ComponentFixture<ControlOccurrenceForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ControlOccurrenceForm], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ControlOccurrenceForm);
    fixture.componentRef.setInput('code', 'IDA-11');
    fixture.detectChanges();
  });

  it('needs the date and the description', () => {
    let sent = 0;
    fixture.componentInstance.submitted.subscribe(() => sent++);
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(sent).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('COMPLIANCE.APPROVAL.OCCURRENCE.ERR_DATE');
    expect(fixture.nativeElement.textContent).toContain('COMPLIANCE.APPROVAL.OCCURRENCE.ERR_DESCRIPTION');
  });

  it('sends the date and the trimmed description', () => {
    let sent: unknown;
    fixture.componentInstance.submitted.subscribe((v) => (sent = v));
    fixture.componentInstance.date.set('2026-11-20');
    fixture.componentInstance.description.set(' Alta de proveedor ');
    fixture.componentInstance.save();
    expect(sent).toEqual({ occurred_on: '2026-11-20', description: 'Alta de proveedor' });
  });
});
