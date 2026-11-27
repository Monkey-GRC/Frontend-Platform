import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { ControlDetail, ControlDetailManagement, ControlManagementState, ManagementAction, ManagementHistoryItem } from '@features/compliance/domain/models/control.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ControlApproval } from './control-approval';

const ANA = { id: 'u1', name: 'Ana', last_name: 'Pérez' };
const PERSON = { id: 'u1', name: 'Ana', last_name: 'Pérez', role: 'responsable' as const };

const MANAGEMENT: ControlDetailManagement = {
  owner_approved_by: null, owner_approved_at: null, approved_by: null, approved_at: null, returned_reason: null, returned_by: null, returned_at: null,
  allowed_actions: [], level: null, level_override: null, exceptions: [], requirements: [], manual_tests: [],
};

function detail(state: ControlManagementState, management: Partial<ControlDetailManagement> = {}): ControlDetail {
  return {
    id: 'c1', service_id: 's1', code: 'IAC-12', requirement_codes: [], own_code: null, name: 'Accesos', origin: 'catalog', type: 'hybrid', trust_criteria: ['security'], approval: 'approved', readiness: 'ready',
    progress: { done: 5, total: 5 }, coverage: { measured: 5, applicable: 5 }, owner: PERSON, executor: null, management_state: state, management: { ...MANAGEMENT, ...management },
    interpretation: { text: '', is_customized: false }, dimensions: [], evidence: [{ requirement_id: 'r1', description: 'Acta del comité', responsible: null, latest_submission: { id: 'sub1', version: 2, evidence_state: 'compliant' } }], causes: [], failing: [],
  };
}

const allowed = (...a: ManagementAction[]): Partial<ControlDetailManagement> => ({ allowed_actions: a });
const LEVEL = { suggested: 'weak' as const, final: 'weak' as const, is_corrected: false, allowed_levels: ['ineffective' as const, 'partial' as const] };
const PLAN = {
  id: 'p1', control_id: 'c1', test: { id: 't9', code: 'T-OPE-009', display_name: 'Revisión' }, requirement: { id: 'r1', code: 'IDA-11' }, what: 'Firmar el acta', owner: ANA, due_date: '2026-12-31', is_overdue: false, status: 'pending' as const, is_valid: true,
  proposed_by: ANA, proposed_at: null, decided_by: null, decided_at: null, decision_reason: null,
};
const HISTORY: ManagementHistoryItem[] = [
  { id: 'h1', type: 'return', at: '2026-11-25T10:00:00Z', actor: ANA, test: null, requirement: null, detail: { reason: 'Falta la firma' } },
  { id: 'h2', type: 'approval', at: '2026-11-24T10:00:00Z', actor: ANA, test: null, requirement: null, detail: { step: 'owner' } },
];

describe('ControlApproval', () => {
  let api: jasmine.SpyObj<ControlService>;
  let mgmt: jasmine.SpyObj<ControlManagementService>;
  let fixture: ComponentFixture<ControlApproval>;

  function render(role: string, d: ControlDetail, totalPages = 1): HTMLElement {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['decide', 'registerResult']);
    mgmt = jasmine.createSpyObj<ControlManagementService>('ControlManagementService', ['history', 'proposeLevel', 'decideLevel', 'decidePlan', 'registerPlan', 'requestNotApplicable', 'decideNotApplicable', 'revertNotApplicable', 'registerOccurrence', 'declareNoOccurrences', 'assignees']);
    mgmt.history.and.returnValue(of({ items: HISTORY, page: { page: 1, pageSize: 10, total: 12, totalPages } }));
    mgmt.assignees.and.returnValue(of([]));
    const options = () => of([{ value: 'pending_approval', label: 'Cumple – por aprobar' }, { value: 'weak', label: 'Débil' }, { value: 'partial', label: 'Parcial' }, { value: 'approval', label: 'Aprobación' }, { value: 'return', label: 'Devolución' }, { value: 'not_applicable_pending', label: 'No aplica, por aprobar' }, { value: 'pending', label: 'Por aprobar' }, { value: 'correct', label: 'Correcto' }]);
    TestBed.configureTestingModule({ imports: [ControlApproval], providers: [provideTranslateService(), provideRouter([]), { provide: ControlService, useValue: api }, { provide: ControlManagementService, useValue: mgmt }, { provide: CatalogService, useValue: { options } }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlApproval);
    fixture.componentRef.setInput('detail', d);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);
  const click = (el: HTMLElement, sel: string) => {
    q(el, sel)!.click();
    fixture.detectChanges();
  };
  const submit = (el: HTMLElement, formSel: string) => {
    el.querySelector<HTMLFormElement>(formSel)!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  describe('state', () => {
    it('shows the catalog label and the help for who has to approve, with the buttons the server allowed', () => {
      const el = render('responsable', detail('pending_approval', allowed('approve', 'return')));
      expect(q(el, '[data-management-state]')?.textContent).toContain('Cumple – por aprobar');
      expect(q(el, '[data-help]')?.textContent).toContain('PENDING_APPROVAL_YOU');
      expect(q(el, '[data-approve]')).not.toBeNull();
      expect(q(el, '[data-return]')).not.toBeNull();
    });

    it('shows neither buttons nor the personal help when the server allowed nothing', () => {
      const el = render('delegado', detail('pending_approval'));
      expect(q(el, '[data-help]')?.textContent).not.toContain('_YOU');
      expect(q(el, '[data-approve]')).toBeNull();
      expect(q(el, '[data-return]')).toBeNull();
      expect(q(el, '[data-register-result]')).toBeNull();
    });

    it('shows the two approvers once approved', () => {
      const el = render('auditor', detail('approved', { owner_approved_by: ANA, approved_by: { id: 'a1', name: 'Luis', last_name: 'Gómez' } }));
      expect(q(el, '[data-help]')?.textContent).toContain('APPROVED_TWO');
    });

    it('asks to confirm with the text of the step, approves, notifies and asks for a refresh', () => {
      let el = render('responsable', detail('pending_approval', allowed('approve')));
      api.decide.and.returnValue(of(detail('owner_approved')));
      let changed = 0;
      fixture.componentInstance.changed.subscribe(() => changed++);
      click(el, '[data-approve]');
      expect(el.querySelector('app-confirm-dialog')?.textContent).toContain('BODY_FIRST');
      el.querySelector<HTMLButtonElement>('app-confirm-dialog button.mk-btn')!.click();
      fixture.detectChanges();
      expect(api.decide).toHaveBeenCalledWith('c1', { decision: 'approve' }, undefined);
      expect(changed).toBe(1);
      expect(TestBed.inject(ToastService).toasts().length).toBe(1);
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('admin_empresa', detail('owner_approved', allowed('approve')));
      click(el, '[data-approve]');
      expect(el.querySelector('app-confirm-dialog')?.textContent).toContain('BODY_FINAL');
    });

    it('shows the text of a 409, closes the dialog and asks for a refresh', () => {
      const el = render('responsable', detail('pending_approval', allowed('approve')));
      api.decide.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'LEVEL_OVERRIDE_PENDING' } } })));
      let changed = 0;
      fixture.componentInstance.changed.subscribe(() => changed++);
      click(el, '[data-approve]');
      el.querySelector<HTMLButtonElement>('app-confirm-dialog button.mk-btn')!.click();
      fixture.detectChanges();
      expect(q(el, '[data-approval-error]')?.textContent).toContain('COMPLIANCE.APPROVAL.ERR.LEVEL_OVERRIDE_PENDING');
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
      expect(changed).toBe(1);
    });
  });

  describe('layout', () => {
    it('puts the state card across the full width when the caller does not see levels, and beside the level card when they do', () => {
      let el = render('delegado', detail('in_progress'));
      expect(q(el, '[data-state-card]')?.classList.contains('md:col-span-2')).toBeTrue();
      expect(q(el, '[data-level-section]')).toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('responsable', detail('in_progress', { level: LEVEL }));
      expect(q(el, '[data-state-card]')?.classList.contains('md:col-span-2')).toBeFalse();
      expect(q(el, '[data-level-section]')).not.toBeNull();
    });
  });

  describe('level', () => {
    it('is hidden when the caller does not see levels', () => {
      expect(q(render('delegado', detail('in_progress')), '[data-level-section]')).toBeNull();
    });

    it('shows the final level, with the suggested one when it was corrected, and the change button only when allowed', () => {
      let el = render('responsable', detail('in_progress', { ...allowed('propose_level'), level: { ...LEVEL, final: 'partial', is_corrected: true } }));
      expect(q(el, '[data-level-chip]')?.textContent).toContain('COMPLIANCE.APPROVAL.LEVEL.CORRECTED');
      expect(q(el, '[data-change-level]')).not.toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('auditor', detail('in_progress', { level: LEVEL }));
      expect(q(el, '[data-level-chip]')?.textContent).toContain('Débil');
      expect(q(el, '[data-change-level]')).toBeNull();
    });

    it('proposes a level with its justification and tells the admin it was sent', () => {
      const el = render('responsable', detail('in_progress', { ...allowed('propose_level'), level: LEVEL }));
      (mgmt.proposeLevel as jasmine.Spy).and.returnValue(of(null));
      let changed = 0;
      fixture.componentInstance.changed.subscribe(() => changed++);
      click(el, '[data-change-level]');
      const form = el.querySelector('app-control-level-form')!;
      expect(form.textContent).toContain('COMPLIANCE.APPROVAL.LEVEL.SEND');
      const component = fixture.debugElement.query((d) => d.name === 'app-control-level-form').componentInstance;
      component.level.set('partial');
      component.justification.set(' Dos accesos sin dueño ');
      submit(el, '#level-form');
      expect(mgmt.proposeLevel).toHaveBeenCalledWith('c1', { proposed_level: 'partial', justification: 'Dos accesos sin dueño' });
      expect(changed).toBe(1);
    });

    it('lets the admin approve or reject a pending proposal, asking the reason for a rejection', () => {
      const override = { id: 'o1', control_id: 'c1', suggested_level: 'weak' as const, proposed_level: 'partial' as const, justification: 'Dos accesos', status: 'pending' as const, is_valid: true, proposed_by: ANA, decided_by: null, proposed_at: null, decided_at: null, decision_reason: null };
      const el = render('admin_empresa', detail('in_progress', { ...allowed('decide_level'), level: LEVEL, level_override: override }));
      expect(q(el, '[data-level-pending]')?.textContent).toContain('COMPLIANCE.APPROVAL.LEVEL.PENDING');
      (mgmt.decideLevel as jasmine.Spy).and.returnValue(of(null));
      click(el, '[data-level-approve]');
      expect(mgmt.decideLevel).toHaveBeenCalledWith('o1', { decision: 'approve' });
      click(el, '[data-level-reject]');
      const reason = fixture.debugElement.query((d) => d.name === 'app-control-reason-form').componentInstance;
      reason.text.set('No coincide con la evidencia');
      submit(el, '#reason-form');
      expect(mgmt.decideLevel).toHaveBeenCalledWith('o1', { decision: 'reject', reason: 'No coincide con la evidencia' });
    });
  });

  describe('rejected requests', () => {
    it('says who rejected the level proposal, the plan and the not-applicable, and why', () => {
      const decided = { decided_by: { id: 'a1', name: 'Luis', last_name: 'Gómez' }, decision_reason: 'No alcanza', status: 'rejected' as const };
      const override = { id: 'o1', control_id: 'c1', suggested_level: 'weak' as const, proposed_level: 'partial' as const, justification: 'x', is_valid: true, proposed_by: ANA, proposed_at: null, decided_at: null, ...decided };
      const REQ = { id: 'r1', code: 'IDA-11', text: 'x', periodicity: 'monthly' as const, applicability: 'applicable' as const, on_demand: null, allowed_actions: [] as ManagementAction[],
        not_applicable: { id: 'n1', control_id: 'c1', requirement: { id: 'r1', code: 'IDA-11', text: 'x' }, reason: 'x', requested_by: ANA, requested_at: null, decided_at: null, reverted_by: null, reverted_at: null, ...decided } };
      const el = render('responsable', detail('in_progress', { level: LEVEL, level_override: override, requirements: [REQ], exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: { ...PLAN, ...decided }, allowed_actions: ['register_plan'] }] }));
      const lines = Array.from(el.querySelectorAll('[data-rejected]')).map((n) => n.textContent);
      expect(lines.length).toBe(3);
      expect(lines.every((l) => l?.includes('REJECTED_BY'))).toBeTrue();
      expect(q(el, '[data-register-plan]')).not.toBeNull();
    });
  });

  describe('exceptions', () => {
    it('lists each exception with its plan, its status and the overdue mark', () => {
      const el = render('responsable', detail('in_progress', { exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: { ...PLAN, is_overdue: true }, allowed_actions: [] }] }));
      expect(q(el, '[data-plan-what]')?.textContent).toContain(PLAN.what);
      expect(q(el, '[data-plan-owner]')?.textContent?.trim()).toBeTruthy();
      expect(q(el, '[data-plan-due]')?.textContent?.trim()).toBeTruthy();
      expect(q(el, '[data-exception-status]')).not.toBeNull();
      expect(q(el, '[data-plan-status]')?.textContent).toContain('Por aprobar');
      expect(q(el, '[data-plan-overdue]')).not.toBeNull();
      expect(q(el, '[data-register-plan]')).toBeNull();
    });

    it('says there is no plan yet and keeps the actions on one line', () => {
      const el = render('responsable', detail('in_progress', { exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: null, allowed_actions: ['register_plan'] }] }));
      expect(q(el, '[data-no-plan]')).not.toBeNull();
      expect(q(el, '[data-register-plan]')!.className).toContain('whitespace-nowrap');
    });

    it('is hidden without exceptions', () => {
      expect(q(render('responsable', detail('in_progress')), '[data-exceptions-section]')).toBeNull();
    });

    it('registers a plan only where the server allowed it and sends the test of that exception', () => {
      const el = render('responsable', detail('in_progress', { exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: null, allowed_actions: ['register_plan'] }] }));
      (mgmt.registerPlan as jasmine.Spy).and.returnValue(of(null));
      click(el, '[data-register-plan]');
      const form = fixture.debugElement.query((d) => d.name === 'app-control-plan-form').componentInstance;
      form.what.set('Firmar el acta');
      form.assignee.set('u2');
      form.due.set('2026-12-31');
      submit(el, '#plan-form');
      expect(mgmt.registerPlan).toHaveBeenCalledWith('c1', { test_id: 't9', what: 'Firmar el acta', owner_id: 'u2', due_date: '2026-12-31' });
    });

    it('shows the text for an invalid owner (422 owner_id.invalid) and keeps the form open', () => {
      const el = render('responsable', detail('in_progress', { exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: null, allowed_actions: ['register_plan'] }] }));
      mgmt.registerPlan.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'x', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'owner_id', code: 'owner_id.invalid', message: 'x' }] } } })));
      click(el, '[data-register-plan]');
      const form = fixture.debugElement.query((d) => d.name === 'app-control-plan-form').componentInstance;
      form.what.set('Firmar');
      form.assignee.set('u9');
      form.due.set('2026-12-31');
      submit(el, '#plan-form');
      expect(q(el, '[data-banner]')?.textContent).toContain('COMPLIANCE.APPROVAL.PLAN.ERR_OWNER');
    });

    it('lets the admin decide a pending plan', () => {
      const el = render('admin_empresa', detail('in_progress', { exceptions: [{ test: PLAN.test, requirement: PLAN.requirement, plan: PLAN, allowed_actions: ['decide_plan'] }] }));
      (mgmt.decidePlan as jasmine.Spy).and.returnValue(of(null));
      click(el, '[data-plan-approve]');
      expect(mgmt.decidePlan).toHaveBeenCalledWith('p1', { decision: 'approve' });
    });
  });

  describe('feedback of an act', () => {
    const REQ = { id: 'r1', code: 'IDA-11', text: 'x', periodicity: 'monthly' as const, applicability: 'applicable' as const, not_applicable: null, on_demand: null, allowed_actions: ['request_not_applicable'] as ManagementAction[] };

    it('puts the spinner on the pressed button and disables the other acts until the server answers and the panel reloads', () => {
      const el = render('admin_empresa', detail('in_progress', { allowed_actions: ['approve', 'return', 'decide_level'], level: LEVEL, level_override: { id: 'l1', control_id: 'c1', suggested_level: 'weak', proposed_level: 'partial', justification: 'x', status: 'pending', is_valid: true, proposed_by: ANA, decided_by: null, proposed_at: null, decided_at: null, decision_reason: null }, requirements: [REQ] }));
      const answer = new Subject<unknown>();
      (mgmt.decideLevel as jasmine.Spy).and.returnValue(answer);
      click(el, '[data-level-approve]');
      expect(q(el, '[data-level-approve]')?.getAttribute('aria-busy')).toBe('true');
      expect(q(el, '[data-level-approve]')?.hasAttribute('disabled')).toBeFalse();
      expect(q(el, '[data-level-reject]')?.hasAttribute('disabled')).toBeTrue();
      expect(q(el, '[data-approve]')?.hasAttribute('disabled')).toBeTrue();
      expect(q(el, '[data-mark-na]')?.hasAttribute('disabled')).toBeTrue();
      answer.next({});
      answer.complete();
      fixture.componentRef.setInput('refreshing', true);
      fixture.detectChanges();
      expect(q(el, '[data-level-approve]')?.getAttribute('aria-busy')).toBe('true');
      expect(q(el, '[data-approve]')?.hasAttribute('disabled')).toBeTrue();
      fixture.componentRef.setInput('refreshing', false);
      fixture.detectChanges();
      expect(q(el, '[data-level-approve]')?.getAttribute('aria-busy')).toBeNull();
      expect(q(el, '[data-approve]')?.hasAttribute('disabled')).toBeFalse();
    });

    it('clears the spinner when the act fails and does not leave it on an old button', () => {
      const el = render('admin_empresa', detail('in_progress', { allowed_actions: ['decide_level'], level: LEVEL, level_override: { id: 'l1', control_id: 'c1', suggested_level: 'weak', proposed_level: 'partial', justification: 'x', status: 'pending', is_valid: true, proposed_by: ANA, decided_by: null, proposed_at: null, decided_at: null, decision_reason: null } }));
      (mgmt.decideLevel as jasmine.Spy).and.returnValue(throwError(() => new HttpErrorResponse({ status: 500, error: {} })));
      click(el, '[data-level-approve]');
      expect(q(el, '[data-level-approve]')?.getAttribute('aria-busy')).toBeNull();
      fixture.componentRef.setInput('refreshing', true);
      fixture.detectChanges();
      expect(q(el, '[data-level-approve]')?.getAttribute('aria-busy')).toBeNull();
    });

    it('gives the focus back to the tab when the act ends and the focus was lost', async () => {
      const el = render('admin_empresa', detail('in_progress', { allowed_actions: ['approve', 'return'] }));
      document.body.appendChild(el);
      fixture.componentRef.setInput('refreshing', true);
      fixture.detectChanges();
      (document.activeElement as HTMLElement | null)?.blur();
      fixture.componentRef.setInput('refreshing', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(q(el, '[data-approval]'));
      el.remove();
    });

    it('does not start a second act while one is running', () => {
      const el = render('admin_empresa', detail('in_progress', { allowed_actions: ['approve', 'return'] }));
      fixture.componentRef.setInput('refreshing', true);
      fixture.detectChanges();
      click(el, '[data-approve]');
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
    });
  });

  describe('requirements', () => {
    const REQ = { id: 'r1', code: 'IDA-11', text: 'Revisión de accesos', periodicity: 'monthly' as const, applicability: 'applicable' as const, not_applicable: null, on_demand: null, allowed_actions: [] as ManagementAction[] };

    it('shows each requirement with its applicability and the buttons of that requirement', () => {
      const el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, allowed_actions: ['request_not_applicable'] }, { ...REQ, id: 'r2', code: 'IDA-12', applicability: 'not_applicable_pending', allowed_actions: [] }] }));
      expect(el.querySelectorAll('[data-applicability]').length).toBe(2);
      expect(q(el, '[data-applicability="not_applicable_pending"]')?.textContent).toContain('No aplica, por aprobar');
      expect(el.querySelectorAll('[data-mark-na]').length).toBe(1);
      expect(q(el, '[data-revert-na]')).toBeNull();
    });

    it('selects by default the first requirement with an action, or the first when none has one, and shows its actions only', () => {
      const rows = [{ ...REQ, id: 'r1', code: 'A-1' }, { ...REQ, id: 'r2', code: 'A-2', allowed_actions: ['request_not_applicable' as ManagementAction] }, { ...REQ, id: 'r3', code: 'A-3', allowed_actions: ['register_occurrence' as ManagementAction] }];
      let el = render('responsable', detail('in_progress', { requirements: rows }));
      expect(q(el, '[data-requirement="r2"]')?.getAttribute('aria-selected')).toBe('true');
      expect(q(el, '[data-requirement="r1"]')?.getAttribute('aria-selected')).toBe('false');
      expect(q(el, '[data-requirement-detail]')?.textContent).toContain('A-2');
      expect(q(el, '[data-mark-na]')).not.toBeNull();
      expect(q(el, '[data-register-occurrence]')).toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('auditor', detail('in_progress', { requirements: [{ ...REQ, id: 'r1', code: 'A-1' }, { ...REQ, id: 'r2', code: 'A-2' }] }));
      expect(q(el, '[data-requirement="r1"]')?.getAttribute('aria-selected')).toBe('true');
      expect(q(el, '[data-no-actions]')?.textContent).toContain('NO_ACTIONS_OWNER_NAMED');
      expect(q(el, '[data-requirement-actions]')).toBeNull();
    });

    it('the detail of the requirement grows with its content: no inner scroll that could cut its code or its text (MD-505)', () => {
      const rows = [{ ...REQ, id: 'r1', code: 'A-1', allowed_actions: ['request_not_applicable' as ManagementAction] }];
      const el = render('responsable', detail('in_progress', { requirements: rows }));
      const card = q(el, '[data-requirement-card]')!;
      expect(card.className).not.toContain('absolute');
      expect(card.className).not.toContain('overflow-y-auto');
      expect(card.textContent).toContain('A-1');
    });

    it('explains why there are no actions: it is the owner who acts, or the request waits for the admin', () => {
      const other = { ...PERSON, id: 'u7', name: 'Luis', last_name: 'Gómez' };
      let d = detail('in_progress', { requirements: [{ ...REQ }] });
      let el = render('delegado', { ...d, owner: null });
      expect(q(el, '[data-no-actions]')?.textContent).toContain('REQUIREMENTS.NO_ACTIONS_OWNER');
      expect(q(el, '[data-no-actions]')?.textContent).not.toContain('NAMED');
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('responsable', { ...d, owner: other });
      expect(q(el, '[data-no-actions]')?.textContent).toContain('NO_ACTIONS_OWNER_NAMED');
      fixture.destroy();
      TestBed.resetTestingModule();
      const pending = { id: 'n1', control_id: 'c1', requirement: { id: 'r1', code: 'IDA-11', text: 'x' }, reason: 'x', status: 'pending' as const, requested_by: ANA, requested_at: null, decided_by: null, decided_at: null, decision_reason: null, reverted_by: null, reverted_at: null };
      d = detail('in_progress', { requirements: [{ ...REQ, applicability: 'not_applicable_pending', not_applicable: pending }] });
      el = render('responsable', d);
      expect(q(el, '[data-no-actions]')?.textContent).toContain('NO_ACTIONS_WAITING');
    });

    it('explains cases without evidence and goes to the Evidence tab', () => {
      const w = (n: number) => ({ window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 3, occurrences_without_evidence: n, has_declaration: false });
      let el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: w(2), allowed_actions: ['register_occurrence'] }] }));
      expect(q(el, '[data-cases-help]')?.textContent).toContain('REQUIREMENTS.CASES_NO_EVIDENCE');
      expect(q(el, '[data-cases-help]')?.textContent).not.toContain('_ONE');
      // «Evidencias» is an underlined link inside the sentence, before its end («… en [Evidencias] para medir este requisito.»), not a button of its own.
      const link = q(el, '[data-cases-help] [data-go-evidence]')!;
      expect(link.className).toContain('mk-link');
      expect(link.className).toContain('underline');
      expect(link.className).not.toContain('mk-btn');
      const sentence = q(el, '[data-cases-help]')!.textContent!.replace(/\s+/g, ' ');
      expect(sentence.indexOf('GO_EVIDENCE')).toBeLessThan(sentence.indexOf('CASES_NO_EVIDENCE_TAIL'));
      expect(sentence.indexOf('REQUIREMENTS.CASES_NO_EVIDENCE ')).toBeLessThan(sentence.indexOf('GO_EVIDENCE'));
      let went = 0;
      fixture.componentInstance.goEvidence.subscribe(() => went++);
      click(el, '[data-go-evidence]');
      expect(went).toBe(1);
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: w(1), allowed_actions: ['register_occurrence'] }] }));
      expect(q(el, '[data-cases-help]')?.textContent).toContain('CASES_NO_EVIDENCE_ONE');
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: w(0), allowed_actions: ['register_occurrence'] }] }));
      expect(q(el, '[data-cases-help]')).toBeNull();
    });

    it('shows the help line under a pending manual test whose on-demand requirement has cases without evidence', () => {
      const w = { window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 2, occurrences_without_evidence: 2, has_declaration: false };
      const test = (status: 'pending' | 'correct') => ({ test: PLAN.test, requirement_id: 'r1', status, accepts_evidence: true, latest_result: null, allowed_actions: [] as ManagementAction[] });
      let el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: w }], manual_tests: [test('pending')] }));
      expect(q(el, '[data-missing-evidence]')).not.toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: w }], manual_tests: [test('correct')] }));
      expect(q(el, '[data-missing-evidence]')).toBeNull();
    });

    it('changes the detail when another requirement is picked, by click or with the arrow keys', () => {
      const rows = [{ ...REQ, id: 'r1', code: 'A-1', allowed_actions: ['request_not_applicable' as ManagementAction] }, { ...REQ, id: 'r2', code: 'A-2', allowed_actions: ['register_occurrence' as ManagementAction] }, { ...REQ, id: 'r3', code: 'A-3' }];
      const el = render('responsable', detail('in_progress', { requirements: rows }));
      expect(q(el, '[data-mark-na]')).not.toBeNull();
      click(el, '[data-requirement="r2"]');
      expect(q(el, '[data-register-occurrence]')).not.toBeNull();
      expect(q(el, '[data-mark-na]')).toBeNull();
      q(el, '[data-requirement="r2"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();
      expect(q(el, '[data-requirement="r3"]')?.getAttribute('aria-selected')).toBe('true');
      expect(q(el, '[data-no-actions]')).not.toBeNull();
      q(el, '[data-requirement="r3"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      fixture.detectChanges();
      expect(q(el, '[data-requirement="r1"]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('shows the quarterly declaration in the list and in the detail', () => {
      const declared = { window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 0, occurrences_without_evidence: 0, has_declaration: true };
      const el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: declared }] }));
      expect(q(el, '[data-demand-mark]')?.textContent).toContain('REQUIREMENTS.DECLARED');
      expect(q(el, '[data-demand-declared]')?.textContent).toContain('REQUIREMENTS.DECLARED');
    });

    it('marks the on-demand requirement in the list with its cases of the quarter', () => {
      const onDemand = { window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 3, occurrences_without_evidence: 0, has_declaration: false };
      const el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: onDemand }, { ...REQ, id: 'r2', code: 'A-2' }] }));
      expect(el.querySelectorAll('[data-demand-mark]').length).toBe(1);
    });

    it('asks for the justification and sends the not-applicable request; shows the text of the last-requirement conflict', () => {
      const el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, allowed_actions: ['request_not_applicable'] }] }));
      mgmt.requestNotApplicable.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'LAST_APPLICABLE_REQUIREMENT' } } })));
      click(el, '[data-mark-na]');
      fixture.debugElement.query((d) => d.name === 'app-control-reason-form').componentInstance.text.set('No aplica a la empresa');
      submit(el, '#reason-form');
      expect(mgmt.requestNotApplicable).toHaveBeenCalledWith('c1', 'r1', 'No aplica a la empresa');
      expect(q(el, '[data-banner]')?.textContent).toContain('COMPLIANCE.APPROVAL.ERR.LAST_APPLICABLE_REQUIREMENT');
      expect(el.querySelector('app-control-reason-form')).not.toBeNull();
    });

    it('reverts a not-applicable directly with its reason and lets the admin decide a pending one', () => {
      const na = { id: 'n1', control_id: 'c1', requirement: { id: 'r1', code: 'IDA-11', text: 'x' }, reason: 'x', status: 'pending' as const, requested_by: ANA, requested_at: null, decided_by: null, decided_at: null, decision_reason: null, reverted_by: null, reverted_at: null };
      let el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, applicability: 'not_applicable', allowed_actions: ['revert_not_applicable'] }] }));
      (mgmt.revertNotApplicable as jasmine.Spy).and.returnValue(of(null));
      click(el, '[data-revert-na]');
      fixture.debugElement.query((d) => d.name === 'app-control-reason-form').componentInstance.text.set('Ahora sí aplica');
      submit(el, '#reason-form');
      expect(mgmt.revertNotApplicable).toHaveBeenCalledWith('c1', 'r1', 'Ahora sí aplica');
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('admin_empresa', detail('in_progress', { requirements: [{ ...REQ, applicability: 'not_applicable_pending', not_applicable: na, allowed_actions: ['decide_not_applicable'] }] }));
      (mgmt.decideNotApplicable as jasmine.Spy).and.returnValue(of(null));
      click(el, '[data-na-approve]');
      expect(mgmt.decideNotApplicable).toHaveBeenCalledWith('n1', { decision: 'approve' });
    });

    it('shows the cases of an on-demand requirement, registers a case and declares there were none after confirming', () => {
      const onDemand = { window_start: '2026-10-01', window_end: '2026-12-31', occurrences_count: 3, occurrences_without_evidence: 2, has_declaration: false };
      const el = render('responsable', detail('in_progress', { requirements: [{ ...REQ, on_demand: onDemand, allowed_actions: ['register_occurrence', 'declare_no_occurrences'] }] }));
      expect(q(el, '[data-demand-cases]')?.textContent).toContain('COMPLIANCE.APPROVAL.REQUIREMENTS.CASES');
      expect(q(el, '[data-demand-cases]')?.textContent).toContain('CASES_WITHOUT');
      (mgmt.registerOccurrence as jasmine.Spy).and.returnValue(of(null));
      mgmt.declareNoOccurrences.and.returnValue(of({}));
      click(el, '[data-register-occurrence]');
      const form = fixture.debugElement.query((d) => d.name === 'app-control-occurrence-form').componentInstance;
      form.date.set('2026-11-20');
      form.description.set('Alta de proveedor');
      submit(el, '#occurrence-form');
      expect(mgmt.registerOccurrence).toHaveBeenCalledWith('c1', 'r1', { occurred_on: '2026-11-20', description: 'Alta de proveedor' });
      click(el, '[data-declare]');
      expect(el.querySelector('app-confirm-dialog')?.textContent).toContain('DECLARE_BODY');
      el.querySelector<HTMLButtonElement>('app-confirm-dialog button.mk-btn')!.click();
      expect(mgmt.declareNoOccurrences).toHaveBeenCalledWith('c1', 'r1');
    });
  });

  describe('manual tests', () => {
    const TEST = { test: { id: 't1', code: 'T-OPE-001', display_name: 'Revisión de accesos' }, requirement_id: 'r1', status: 'correct' as const, accepts_evidence: true, latest_result: null, allowed_actions: [] as ManagementAction[] };

    it('shows the latest result with who and when, or that there is none, and the button only where allowed', () => {
      const result = { result: 'correct' as const, note: 'Todo en orden', registered_by: ANA, registered_at: '2026-11-20T10:00:00Z' };
      const el = render('responsable', detail('in_progress', { manual_tests: [{ ...TEST, latest_result: result, allowed_actions: ['register_result'] }, { ...TEST, test: { id: 't2', code: 'T-OPE-002', display_name: 'Otra' }, status: 'pending' }] }));
      expect(el.querySelectorAll('[data-test-status]').length).toBe(2);
      expect(q(el, '[data-latest-result]')?.textContent).toContain('Correcto');
      expect(q(el, '[data-latest-result]')?.textContent).toContain('Ana Pérez');
      expect(q(el, '[data-latest-result]')?.textContent).toContain('Todo en orden');
      expect(q(el, '[data-no-result]')).not.toBeNull();
      expect(el.querySelectorAll('[data-register-result]').length).toBe(1);
    });

    it('registers a result through the form', () => {
      const el = render('responsable', detail('in_progress', { manual_tests: [{ ...TEST, allowed_actions: ['register_result'] }] }));
      (api.registerResult as jasmine.Spy).and.returnValue(of(null));
      let changed = 0;
      fixture.componentInstance.changed.subscribe(() => changed++);
      click(el, '[data-register-result]');
      const form = fixture.debugElement.query((d) => d.name === 'app-control-result-form').componentInstance;
      form.result.set('correct');
      form.save();
      expect(api.registerResult).toHaveBeenCalledWith('c1', 't1', { result: 'correct' });
      fixture.detectChanges();
      expect(changed).toBe(1);
      expect(el.querySelector('app-control-result-form')).toBeNull();
    });

    it('says there are no manual tests when the control has none', () => {
      expect(q(render('responsable', detail('in_progress')), '[data-manual-tests-section]')?.textContent).toContain('COMPLIANCE.APPROVAL.TESTS.NONE');
    });
  });

  describe('history', () => {
    it('lists each act as date, person and action with its reason below, and has a Show more when there are more pages', () => {
      const el = render('auditor', detail('in_progress'), 2);
      const rows = el.querySelectorAll('[data-history-row]');
      expect(rows.length).toBe(2);
      expect(q(el, '[data-history-actor]')?.textContent).toContain('Ana Pérez');
      expect(q(el, '[data-history-action]')?.textContent).toContain('Devolución');
      expect(q(el, '[data-history-why]')?.textContent).toContain('Falta la firma');
      expect(q(el, '[data-history-more]')).not.toBeNull();
    });

    it('appends the next page on Show more and hides the button on the last one', () => {
      const el = render('auditor', detail('in_progress'), 2);
      mgmt.history.and.returnValue(of({ items: [{ ...HISTORY[1], id: 'h3' }], page: { page: 2, pageSize: 10, total: 12, totalPages: 2 } }));
      click(el, '[data-history-more]');
      expect(mgmt.history).toHaveBeenCalledWith('c1', 2, 10);
      expect(el.querySelectorAll('[data-history-row]').length).toBe(3);
      expect(q(el, '[data-history-more]')).toBeNull();
    });

    it('says there is nothing yet when empty and offers a retry on failure', () => {
      let el = render('auditor', detail('in_progress'));
      mgmt.history.and.returnValue(of({ items: [], page: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }));
      fixture.debugElement.query((d) => d.name === 'app-control-history').componentInstance.reload();
      fixture.detectChanges();
      expect(q(el, '[data-history-empty]')).not.toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      el = render('auditor', detail('in_progress'));
      mgmt.history.and.returnValue(throwError(() => new Error('x')));
      fixture.debugElement.query((d) => d.name === 'app-control-history').componentInstance.reload();
      fixture.detectChanges();
      expect(q(el, '[data-history-reload-error]')).not.toBeNull();
    });
  });
});
