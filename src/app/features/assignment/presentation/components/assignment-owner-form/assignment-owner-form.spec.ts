import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { TeamMember } from '@shared/domain/models/team.models';
import { AssignmentItem } from '@features/assignment/domain/models/assignment.models';
import { AssignmentOwnerForm } from './assignment-owner-form';

const control = (n: number): AssignmentItem => ({
  client_control_id: `c-${n}`, code: `IAC-${n}`, requirement_codes: [], name: 'n', service: { id: 's', name: 'S' }, categories: [], assignment: 'unassigned', owner: null, executor: null, state: 'effective',
});
const member = (id: string, name: string, role: TeamMember['role']): TeamMember => ({ id, email: `${id}@x.co`, name, last_name: 'Pérez', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-01-01' });

describe('AssignmentOwnerForm', () => {
  let fixture: ComponentFixture<AssignmentOwnerForm>;
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);

  function setup(controls = [control(1), control(2)], candidates = [member('r1', 'Laura', 'responsable'), member('a1', 'Rod', 'admin_empresa')]) {
    TestBed.configureTestingModule({ imports: [AssignmentOwnerForm], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(AssignmentOwnerForm);
    fixture.componentRef.setInput('controls', controls);
    fixture.componentRef.setInput('candidates', candidates);
    fixture.componentRef.setInput('meId', 'a1');
    fixture.detectChanges();
  }

  it('shows the code of every selected control and keeps the submit off until someone is chosen', () => {
    setup();
    expect(Array.from(document.querySelectorAll('[data-testid="owner-controls"] app-tag')).map((t) => t.textContent!.trim())).toEqual(['IAC-1', 'IAC-2']);
    expect((q('[data-testid="owner-submit"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('says «and N more» past eight codes', () => {
    setup(Array.from({ length: 11 }, (_, i) => control(i + 1)));
    expect(document.querySelectorAll('[data-testid="owner-controls"] app-tag').length).toBe(8);
    expect(q('[data-testid="owner-controls"]')!.textContent).toContain('ASSIGNMENT.FORM.AND_MORE');
  });

  it('emits the chosen owner, which can be the administrator themselves', () => {
    setup();
    const sent: (string | null)[] = [];
    fixture.componentInstance.submitted.subscribe((v) => sent.push(v));
    pickOption(document, '[data-testid="owner-select"]', 'a1', () => fixture.detectChanges());
    (q('[data-testid="owner-submit"]') as HTMLButtonElement).click();
    expect(sent).toEqual(['a1']);
  });

  it('emits null to leave the controls without an owner', () => {
    setup();
    const sent: (string | null)[] = [];
    fixture.componentInstance.submitted.subscribe((v) => sent.push(v));
    pickOption(document, '[data-testid="owner-select"]', '__none__', () => fixture.detectChanges());
    (q('[data-testid="owner-submit"]') as HTMLButtonElement).click();
    expect(sent).toEqual([null]);
  });

  it('shows the error of the last attempt and says so when there is nobody to choose', () => {
    setup([control(1)], []);
    fixture.componentRef.setInput('error', 'Esa persona ya no puede ser dueña');
    fixture.detectChanges();
    expect(q('[data-testid="owner-error"]')!.textContent).toContain('Esa persona ya no puede ser dueña');
    expect(q('[data-testid="owner-no-candidates"]')).not.toBeNull();
  });
});
