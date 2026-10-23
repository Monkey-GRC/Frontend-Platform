import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlChange, ControlDetail } from '../../../domain/models/control.models';
import { ControlService } from '../../../domain/services/control.service';
import { EvidenceService } from '../../../domain/services/evidence.service';
import { ControlDetailPanel } from './control-detail-panel';

const DETAIL: ControlDetail = {
  id: 'c1',
  service_id: 's1',
  own_code: null,
  name: 'Gestión de accesos de usuarios',
  origin: 'catalog',
  type: 'hybrid',
  trust_criteria: ['security'],
  approval: 'approved',
  readiness: 'not_measured',
  progress: { done: 0, total: 5 },
  coverage: { measured: 0, applicable: 5 },
  assigned_to: null,
  has_pending_change: false,
  interpretation: { text: 'Los accesos se otorgan con el formulario de TI.', is_customized: false },
  dimensions: [
    { dimension: 'policy', applies: true, type: 'manual', reason_not_applicable: null },
    { dimension: 'database', applies: false, type: null, reason_not_applicable: 'No operamos bases de datos propias.' },
  ],
  evidence: [],
  causes: [],
  failing: [],
};

const PENDING_RETIRE: ControlChange = { id: 'p1', control_id: 'c1', change_type: 'retire', status: 'pending', requested_at: '2026-10-14T00:00:00Z', decision_note: null };

describe('ControlDetailPanel', () => {
  let api: jasmine.SpyObj<ControlService>;
  let evidence: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlDetailPanel>;

  function setup(role: string, detail: ControlDetail = DETAIL, pending: ControlChange[] = []): ControlDetailPanel {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['get', 'changes', 'proposeChange']);
    api.get.and.returnValue(of(detail));
    api.changes.and.returnValue(of(pending));
    evidence = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'upload', 'download']);
    evidence.list.and.returnValue(NEVER);
    TestBed.configureTestingModule({ imports: [ControlDetailPanel], providers: [provideTranslateService(), { provide: ControlService, useValue: api }, { provide: EvidenceService, useValue: evidence }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlDetailPanel);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('asks for the technical view for the company admin and the auditor, and the business view for the functional user', () => {
    setup('admin_empresa');
    expect(api.get).toHaveBeenCalledWith('c1', 'technical');
    TestBed.resetTestingModule();
    setup('auditor');
    expect(api.get).toHaveBeenCalledWith('c1', 'technical');
    TestBed.resetTestingModule();
    setup('funcional');
    expect(api.get).toHaveBeenCalledWith('c1', undefined);
  });

  it('shows the code and the requirements it covers next to the name, and the percentages', () => {
    const panel = setup('admin_empresa', { ...DETAIL, code: 'IAC-12', requirement_codes: ['CC6.1'], progress: { done: 3, total: 5 }, coverage: { measured: 4, applicable: 5 } });
    expect(text()).toContain('IAC-12');
    expect(text()).toContain('CC6.1');
    expect(panel.pct(3, 5).replace(/\s/g, '')).toBe('60%');
    expect(panel.pct(4, 5).replace(/\s/g, '')).toBe('80%');
  });

  it('puts the evidence of the control inside the drawer, for this control, and lets only the company admin and the functional user upload it', () => {
    const panel = setup('admin_empresa');
    expect(fixture.nativeElement.querySelector('app-control-evidence')).not.toBeNull();
    expect(evidence.list).toHaveBeenCalledWith('c1', 'technical');
    expect(panel.canUploadEvidence()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('funcional').canUploadEvidence()).toBeTrue();
    for (const role of ['auditor', 'consultor']) {
      TestBed.resetTestingModule();
      expect(setup(role).canUploadEvidence()).toBeFalse();
    }
  });

  it('shows to the company admin every test of the control, next to the evidence it asks for', () => {
    setup('admin_empresa', {
      ...DETAIL,
      technical: {
        points_of_focus: [],
        control_state: 'incomplete',
        tests_count: 2,
        tests: [
          { test_id: 't-doc-1', test_code: 'T-DOC-001', display_name: 'Revisión de diseño de la política', dimension: 'policy', state: 'pending' },
          { test_id: 't-srv-1', test_code: 'T-SRV-001', display_name: 'Configuración de servidores', dimension: 'server', state: 'no_assets' },
        ],
      },
    });
    expect(text()).toContain('COMPLIANCE.REQUIRES.TITLE');
    expect(text()).toContain('T-DOC-001');
    expect(text()).toContain('Configuración de servidores');
    expect(fixture.nativeElement.querySelector('app-control-evidence')).not.toBeNull();
  });

  it('only says how many tests the control has when the view brings no list, as for the functional user', () => {
    setup('funcional');
    expect(text()).toContain('COMPLIANCE.TESTS.COUNT_ONLY');
    expect(fixture.nativeElement.querySelector('[data-test-state]')).toBeNull();
  });

  it('lets the company admin propose changes, and only reads for the auditor and the consultant', () => {
    expect(setup('admin_empresa').canPropose()).toBeTrue();
    expect(text()).toContain('COMPLIANCE.DETAIL.RETIRE');
    for (const role of ['auditor', 'consultor']) {
      TestBed.resetTestingModule();
      expect(setup(role).canPropose()).toBeFalse();
      expect(text()).not.toContain('COMPLIANCE.DETAIL.RETIRE');
    }
  });

  it('sends the interpretation as a proposal with the text trimmed, and asks the list to refresh', () => {
    const panel = setup('admin_empresa');
    api.proposeChange.and.returnValue(of({ id: 'n', control_id: 'c1', change_type: 'edit_interpretation', status: 'pending', requested_at: '', decision_note: null }));
    let changed = 0;
    panel.changed.subscribe(() => changed++);

    panel.startInterpretation();
    panel.interpretationDraft.set('  Se revisa cada trimestre.  ');
    panel.submitInterpretation();

    expect(api.proposeChange).toHaveBeenCalledWith('c1', { change_type: 'edit_interpretation', proposed_values: { interpretation: 'Se revisa cada trimestre.' } });
    expect(changed).toBe(1);
    expect(panel.mode()).toBe('view');
    expect(panel.notice()).not.toBeNull();
  });

  it('does not send a dimension that does not apply without its reason', () => {
    const panel = setup('admin_empresa');
    panel.startDimensions();
    panel.toggleDimension(0, false);
    expect(panel.dimensionsValid()).toBeFalse();
    panel.submitDimensions();
    expect(api.proposeChange).not.toHaveBeenCalled();

    api.proposeChange.and.returnValue(of({ id: 'n', control_id: 'c1', change_type: 'edit_dimensions', status: 'pending', requested_at: '', decision_note: null }));
    panel.setReason(0, 'No usamos documentos.');
    panel.submitDimensions();
    expect(api.proposeChange).toHaveBeenCalledWith('c1', {
      change_type: 'edit_dimensions',
      proposed_values: {
        dimensions: [
          { dimension: 'policy', applies: false, reason_not_applicable: 'No usamos documentos.' },
          { dimension: 'database', applies: false, reason_not_applicable: 'No operamos bases de datos propias.' },
        ],
      },
    });
  });

  it('shows the 422 error of a field under that field and keeps the editor open', () => {
    const panel = setup('admin_empresa');
    const body = { message: 'validation.failed', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'proposed_values.interpretation', code: 'string.max', message: 'Es demasiado largo.' }] } };
    api.proposeChange.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: body })));

    panel.startInterpretation();
    panel.interpretationDraft.set('texto');
    panel.submitInterpretation();
    fixture.detectChanges();

    expect(panel.mode()).toBe('interpretation');
    expect(panel.fieldError('proposed_values.interpretation')).toBe('Es demasiado largo.');
    expect(text()).toContain('Es demasiado largo.');
  });

  it('blocks proposing again what is already waiting for the consultant', () => {
    const panel = setup('admin_empresa', DETAIL, [PENDING_RETIRE]);
    expect(panel.hasPending('retire')).toBeTrue();
    expect(panel.hasPending('edit_dimensions')).toBeFalse();
  });

  it('asks for confirmation before proposing to retire, and sends nothing until confirmed', () => {
    const panel = setup('admin_empresa');
    panel.askRetire();
    expect(panel.confirmingRetire()).toBeTrue();
    expect(api.proposeChange).not.toHaveBeenCalled();

    api.proposeChange.and.returnValue(of({ id: 'n', control_id: 'c1', change_type: 'retire', status: 'pending', requested_at: '', decision_note: null }));
    panel.confirmRetire();
    expect(api.proposeChange).toHaveBeenCalledWith('c1', { change_type: 'retire', proposed_values: {} });
    expect(panel.confirmingRetire()).toBeFalse();
  });
});
