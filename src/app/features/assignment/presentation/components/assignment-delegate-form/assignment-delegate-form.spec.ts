import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { TeamMember } from '@shared/domain/models/team.models';
import { AssignmentItem } from '@features/assignment/domain/models/assignment.models';
import { DelegationScope } from '@features/assignment/domain/utils/assignment-people';
import { AssignmentDelegateForm } from './assignment-delegate-form';

const control: AssignmentItem = {
  client_control_id: 'c-1', code: 'IAC-1', requirement_codes: [], name: 'n', service: { id: 's', name: 'S' }, categories: [], assignment: 'assigned', owner: null, executor: null, state: 'effective',
};
const delegate = (id: string, name: string): TeamMember => ({ id, email: `${id}@x.co`, name, last_name: 'Pérez', role: 'delegado', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-01-01' });

describe('AssignmentDelegateForm', () => {
  let fixture: ComponentFixture<AssignmentDelegateForm>;
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);

  function setup(scope: DelegationScope, delegates: TeamMember[] = []) {
    TestBed.configureTestingModule({ imports: [AssignmentDelegateForm], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(AssignmentDelegateForm);
    fixture.componentRef.setInput('controls', [control]);
    fixture.componentRef.setInput('scope', scope);
    fixture.componentRef.setInput('delegates', delegates);
    fixture.detectChanges();
  }

  it('lets the person choose a delegate of the team of the owner and emits it', () => {
    setup({ kind: 'team', ownerId: 'r1', ownerName: 'Laura Pérez' }, [delegate('d1', 'Juan')]);
    const sent: (string | null)[] = [];
    fixture.componentInstance.submitted.subscribe((v) => sent.push(v));
    expect((q('[data-testid="delegate-submit"]') as HTMLButtonElement).disabled).toBeTrue();
    pickOption(document, '[data-testid="delegate-select"]', 'd1', () => fixture.detectChanges());
    (q('[data-testid="delegate-submit"]') as HTMLButtonElement).click();
    expect(sent).toEqual(['d1']);
  });

  it('removes the delegate with null', () => {
    setup({ kind: 'team', ownerId: 'r1', ownerName: 'Laura Pérez' }, [delegate('d1', 'Juan')]);
    const sent: (string | null)[] = [];
    fixture.componentInstance.submitted.subscribe((v) => sent.push(v));
    pickOption(document, '[data-testid="delegate-select"]', '__none__', () => fixture.detectChanges());
    (q('[data-testid="delegate-submit"]') as HTMLButtonElement).click();
    expect(sent).toEqual([null]);
  });

  it('tells the owner has no team instead of showing an empty list', () => {
    setup({ kind: 'team', ownerId: 'r1', ownerName: 'Laura Pérez' }, []);
    expect(q('[data-testid="delegate-no-team"]')).not.toBeNull();
  });

  it('with different owners (or none) it explains why and only offers to remove, with no list of people', () => {
    setup({ kind: 'remove_only', reason: 'mixed_owners' });
    expect(q('[data-testid="delegate-reason"]')!.textContent).toContain('ASSIGNMENT.DELEGATE.REASON_MIXED_OWNERS');
    expect(q('[data-testid="delegate-select"]')).toBeNull();
    const sent: (string | null)[] = [];
    fixture.componentInstance.submitted.subscribe((v) => sent.push(v));
    const submit = q('[data-testid="delegate-submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeFalse();
    expect(submit.textContent).toContain('ASSIGNMENT.DELEGATE.SUBMIT_REMOVE');
    submit.click();
    expect(sent).toEqual([null]);
  });
});
