import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ControlReasonForm } from './control-reason-form';

describe('ControlReasonForm', () => {
  let fixture: ComponentFixture<ControlReasonForm>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ControlReasonForm], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ControlReasonForm);
    fixture.componentRef.setInput('titleKey', 'T.TITLE');
    fixture.componentRef.setInput('labelKey', 'T.LABEL');
    fixture.componentRef.setInput('errorKey', 'T.ERR');
    fixture.componentRef.setInput('submitKey', 'T.SUBMIT');
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('sends nothing without the text and shows its error', () => {
    let sent = 0;
    fixture.componentInstance.submitted.subscribe(() => sent++);
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(sent).toBe(0);
    expect(el.textContent).toContain('T.ERR');
  });

  it('sends the trimmed text and marks the form as changed while there is text', () => {
    let sent = '';
    fixture.componentInstance.submitted.subscribe((v) => (sent = v));
    expect(fixture.componentInstance.changed()).toBeFalse();
    fixture.componentInstance.text.set('  Un motivo  ');
    expect(fixture.componentInstance.changed()).toBeTrue();
    fixture.componentInstance.save();
    expect(sent).toBe('Un motivo');
  });

  it('does not send twice while busy and shows the server banner', () => {
    let sent = 0;
    fixture.componentInstance.submitted.subscribe(() => sent++);
    fixture.componentInstance.text.set('x');
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('banner', 'No se pudo');
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(sent).toBe(0);
    expect(el.querySelector('[data-banner]')?.textContent).toContain('No se pudo');
  });
});
