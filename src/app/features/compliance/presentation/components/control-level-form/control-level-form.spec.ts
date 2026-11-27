import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ControlLevelForm } from './control-level-form';

describe('ControlLevelForm', () => {
  let fixture: ComponentFixture<ControlLevelForm>;
  let el: HTMLElement;

  function setup(direct = false): void {
    const options = () => of([{ value: 'weak', label: 'Débil' }, { value: 'partial', label: 'Parcial' }]);
    TestBed.configureTestingModule({ imports: [ControlLevelForm], providers: [provideTranslateService(), { provide: CatalogService, useValue: { options } }] });
    fixture = TestBed.createComponent(ControlLevelForm);
    fixture.componentRef.setInput('code', 'IAC-12');
    fixture.componentRef.setInput('allowed', ['weak', 'partial']);
    fixture.componentRef.setInput('direct', direct);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  it('cannot be sent without a level, and needs the justification', () => {
    setup();
    let sent = 0;
    fixture.componentInstance.submitted.subscribe(() => sent++);
    fixture.componentInstance.save();
    expect(sent).toBe(0);
    fixture.componentInstance.level.set('weak');
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(sent).toBe(0);
    expect(el.textContent).toContain('COMPLIANCE.APPROVAL.LEVEL.ERR_JUSTIFICATION');
  });

  it('sends the level and the trimmed justification', () => {
    setup();
    let sent: unknown;
    fixture.componentInstance.submitted.subscribe((v) => (sent = v));
    fixture.componentInstance.level.set('partial');
    fixture.componentInstance.justification.set(' Dos accesos sin dueño ');
    fixture.componentInstance.save();
    expect(sent).toEqual({ proposed_level: 'partial', justification: 'Dos accesos sin dueño' });
  });

  it('says Send, or Save when the change is born approved', () => {
    setup();
    expect(el.querySelector('[data-save]')?.textContent).toContain('LEVEL.SEND');
    fixture.destroy();
    TestBed.resetTestingModule();
    setup(true);
    expect(el.querySelector('[data-save]')?.textContent).toContain('LEVEL.SAVE');
  });
});
