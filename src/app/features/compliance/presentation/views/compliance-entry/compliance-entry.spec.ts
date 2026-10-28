import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ComplianceServicesService } from '../../../domain/services/compliance-services.service';
import { ComplianceEntryView } from './compliance-entry';

// Una empresa sin servicios para este rol: solo el administrador puede crear uno (D96); el funcional espera su asignación y el auditor espera que se declare.
describe('ComplianceEntryView · sin servicios', () => {
  function render(role: string): HTMLElement {
    TestBed.configureTestingModule({
      imports: [ComplianceEntryView],
      providers: [provideRouter([]), provideTranslateService(), { provide: ComplianceServicesService, useValue: { list: () => of([]) } }],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    const fixture = TestBed.createComponent(ComplianceEntryView);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers the administrator to create the first service', () => {
    const el = render('admin_empresa');
    expect(el.textContent).toContain('COMPLIANCE.ENTRY.EMPTY_TITLE');
    expect(el.querySelector('a[href="/services/new"]')).not.toBeNull();
  });

  it('tells the functional user that the work is assigned by the administrator, and offers nothing to create', () => {
    const el = render('funcional');
    expect(el.textContent).toContain('COMPLIANCE.ENTRY.EMPTY_FUNCIONAL_TITLE');
    expect(el.textContent).not.toContain('COMPLIANCE.ENTRY.EMPTY_TITLE');
    expect(el.querySelector('a[href="/services/new"]')).toBeNull();
  });

  it('tells the auditor there is nothing to review yet, and offers nothing to create', () => {
    const el = render('auditor');
    expect(el.textContent).toContain('COMPLIANCE.ENTRY.EMPTY_READER_TITLE');
    expect(el.querySelector('a[href="/services/new"]')).toBeNull();
  });
});
