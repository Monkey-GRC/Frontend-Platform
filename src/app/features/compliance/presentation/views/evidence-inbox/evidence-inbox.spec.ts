import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlListItem } from '@features/compliance/domain/models/control.models';
import { EvidenceRequirement, EvidenceSubmission, ServiceEvidenceRequirement, buildInboxRows, evidenceFilterOf } from '@features/compliance/domain/models/evidence.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { EvidenceInboxView } from './evidence-inbox';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';

const control = (id: string, name: string, code: string | null = null): ControlListItem => ({
  id, code: code ?? id.toUpperCase(), requirement_codes: [], own_code: null, name, origin: 'catalog', type: 'hybrid', trust_criteria: ['security'], approval: 'approved', readiness: 'not_measured',
  progress: { done: 0, total: 1 }, coverage: { measured: 0, applicable: 1 }, owner: null, executor: null,
});
const person = { id: 'u1', name: 'Laura', last_name: 'Gómez' };
const submission = (version: number, state: EvidenceSubmission['evidence_state'] = 'pending'): EvidenceSubmission => ({
  id: `s${version}`, version, file_name: `politica-v${version}.pdf`, file_type: 'application/pdf', file_size: 1000, integrity_hash: 'abc',
  submitted_by: person, submitted_at: '2026-10-14T17:05:12Z', evidence_state: state, ai: null,
});
const requirement = (id: string, submissions: EvidenceSubmission[] = []): EvidenceRequirement => ({
  id, code: `EV-${id}`, sequence: 1, description: `Documento ${id}`, dimension: 'policy', test: null, validity_within_period: 'Dentro del período', origin: 'catalog',
  responsible: { id: 'r1', type: 'compliance', person_name: 'Marta Ruiz' }, submissions,
});

const CONTROLS = [control('c1', 'Disposición de activos', 'AST-1'), control('c2', 'Capacidad del sistema', 'CAP-1'), control('c3', 'Sin evidencias')];
const EVIDENCE: Record<string, EvidenceRequirement[]> = {
  c1: [requirement('e1', [submission(2), submission(1)]), requirement('e2')],
  c2: [requirement('e3', [submission(1, 'compliant')])],
  c3: [],
};

describe('EvidenceInboxView', () => {
  let controls: jasmine.SpyObj<ControlService>;
  let api: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<EvidenceInboxView>;

  function setup(role = 'admin_empresa'): EvidenceInboxView {
    controls = jasmine.createSpyObj<ControlService>('ControlService', ['listAll']);
    controls.listAll.and.returnValue(of(CONTROLS));
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listByService']);
    api.listByService.and.returnValue(of(Object.entries(EVIDENCE).flatMap(([controlId, items]) => items.map((i): ServiceEvidenceRequirement => ({ ...i, control_id: controlId })))));
    TestBed.configureTestingModule({
      imports: [EvidenceInboxView],
      providers: [
        provideTranslateService(),
        { provide: ControlService, useValue: controls },
        { provide: EvidenceService, useValue: api },
        { provide: ActiveComplianceService, useValue: { serviceId: signal<string | null>('s1') } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(EvidenceInboxView);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('asks for the controls and the evidence of the whole service with one request each, in the technical view for the company admin', () => {
    setup();
    expect(controls.listAll).toHaveBeenCalledOnceWith('s1', 'technical');
    expect(api.listByService).toHaveBeenCalledOnceWith('s1', 'technical');
    expect(api.list).not.toHaveBeenCalled();
  });

  it('asks for the evidence of the service once and without the technical view for the other roles', () => {
    setup('funcional');
    expect(controls.listAll).toHaveBeenCalledOnceWith('s1', undefined);
    expect(api.listByService).toHaveBeenCalledOnceWith('s1', undefined);
    expect(api.list).not.toHaveBeenCalled();
  });

  it('lists one row per required evidence with its control, code, responsible and the state of the latest delivery', () => {
    const view = setup();
    expect(view.rows().map((r) => r.requirement.id)).toEqual(['e1', 'e2', 'e3']);
    expect(text()).toContain('Disposición de activos');
    expect(text()).toContain('AST-1');
    expect(text()).toContain('Documento e1');
    expect(fixture.nativeElement.querySelector('[data-state="pending"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-state="compliant"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-state="missing"]')).not.toBeNull();
  });

  it('says each state with a dot and its word (never a coloured pill) and keeps the table the only one of the view', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const tone = (state: string) => el.querySelector(`app-status-indicator[data-state="${state}"]`)!.getAttribute('data-tone');
    expect(tone('compliant')).toBe('ok');
    expect(tone('pending')).toBe('warn');
    expect(tone('missing')).toBe('neutral');
    expect(el.innerHTML).not.toContain('rounded-full px-');
    expect(el.querySelectorAll('app-data-table').length).toBe(1);
  });

  it('leaves out the controls that ask for no evidence', () => {
    setup();
    expect(text()).not.toContain('Sin evidencias');
  });

  it('filters by what is missing, what awaits review and what was already reviewed, using the state the server calculated', () => {
    const view = setup();
    view.pick('missing');
    expect(view.visible().map((r) => r.requirement.id)).toEqual(['e2']);
    view.pick('to_review');
    expect(view.visible().map((r) => r.requirement.id)).toEqual(['e1']);
    view.pick('reviewed');
    expect(view.visible().map((r) => r.requirement.id)).toEqual(['e3']);
    view.pick('all');
    expect(view.visible().length).toBe(3);
  });

  it('shows an error with a retry when the evidence of the service fails', () => {
    setup();
    api.listByService.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('error');
  });

  it('shows an error with a retry when the list of controls itself fails', () => {
    setup();
    controls.listAll.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('error');
    expect(text()).toContain('COMPLIANCE.EVIDENCE_INBOX.LOAD_ERROR_TITLE');
  });

  it('opens the control of the row clicked, where the evidence is uploaded and downloaded', () => {
    const view = setup();
    view.open(view.rows()[1]);
    expect(view.selected()).toBe('c1');
  });

  it('reloads only the evidence of the control where something was uploaded', () => {
    const view = setup();
    api.list.calls.reset();
    api.list.and.returnValue(of([requirement('e1', [submission(3)]), requirement('e2', [submission(1)])]));
    view.reload('c1');
    expect(api.list).toHaveBeenCalledOnceWith('c1', 'technical');
    expect(view.rows().find((r) => r.requirement.id === 'e2')?.latest?.version).toBe(1);
    expect(view.rows().map((r) => r.requirement.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('offers no way to approve or reject: the company only provides evidence (D84)', () => {
    setup();
    expect(text()).not.toContain('APPROVE');
    expect(text()).not.toContain('REJECT');
  });
});

describe('evidence inbox helpers', () => {
  it('groups a row by the state of its latest delivery', () => {
    const row = (state?: EvidenceSubmission['evidence_state']) => buildInboxRows([control('c', 'C')], new Map([['c', [requirement('e', state ? [submission(1, state)] : [])]]]))[0];
    expect(evidenceFilterOf(row())).toBe('missing');
    expect(evidenceFilterOf(row('pending'))).toBe('to_review');
    expect(evidenceFilterOf(row('in_review'))).toBe('to_review');
    expect(evidenceFilterOf(row('compliant'))).toBe('reviewed');
    expect(evidenceFilterOf(row('non_compliant'))).toBe('reviewed');
    expect(evidenceFilterOf(row('expired'))).toBe('reviewed');
  });

  it('keeps the order of the controls and takes the latest delivery as the first one', () => {
    const rows = buildInboxRows([control('b', 'B'), control('a', 'A')], new Map([['a', [requirement('ea', [submission(2), submission(1)])]], ['b', [requirement('eb')]]]));
    expect(rows.map((r) => r.control.id)).toEqual(['b', 'a']);
    expect(rows[1].latest?.version).toBe(2);
  });
});
