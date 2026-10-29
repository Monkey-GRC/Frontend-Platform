import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { OWNER_ASSIGNMENT_ENABLED } from '@config/features.config';
import { SessionService } from '@core/domain/services/session.service';
import { ControlDetail, ControlResponsible, ResponsibleCandidate } from '../../../domain/models/control.models';
import { ControlService } from '../../../domain/services/control.service';
import { EvidenceService } from '../../../domain/services/evidence.service';
import { ControlDetailPanel } from './control-detail-panel';

const DETAIL: ControlDetail = {
  id: 'c1',
  service_id: 's1',
  code: 'IAC-12',
  requirement_codes: [],
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
  interpretation: { text: 'Los accesos se otorgan con el formulario de TI.', is_customized: false },
  dimensions: [
    { dimension: 'policy', applies: true, type: 'manual', reason_not_applicable: null },
    { dimension: 'database', applies: false, type: null, reason_not_applicable: 'No operamos bases de datos propias.' },
  ],
  evidence: [],
  causes: [],
  failing: [],
};

const RESPONSIBLES: ControlResponsible[] = [
  { dimension: 'policy', tests_count: 2, owner: { id: 'ana', email: 'ana@acme.co', name: 'Ana', last_name: 'Ruiz' }, source: 'service' },
  { dimension: 'cloud', tests_count: 1, owner: null, source: null },
];
const CANDIDATES: ResponsibleCandidate[] = [
  { id: 'ana', email: 'ana@acme.co', name: 'Ana', last_name: 'Ruiz', status: 'active', dimensions: ['policy'] },
  { id: 'beto', email: 'beto@acme.co', name: null, last_name: null, status: 'active', dimensions: ['policy', 'cloud'] },
];

describe('ControlDetailPanel', () => {
  let api: jasmine.SpyObj<ControlService>;
  let evidence: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlDetailPanel>;

  function setup(role: string, detail: ControlDetail = DETAIL, responsibles: ControlResponsible[] = RESPONSIBLES): ControlDetailPanel {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['get', 'update', 'retire', 'responsibles', 'setResponsible', 'candidates']);
    api.get.and.returnValue(of(detail));
    api.responsibles.and.returnValue(of(responsibles));
    api.candidates.and.returnValue(of(CANDIDATES));
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

  it('shows the five dimensions in one row, ticked when they apply and crossed when they do not (or the control has no test for them)', () => {
    setup('admin_empresa');
    const cells = Array.from(fixture.nativeElement.querySelectorAll('[data-dimension]')) as HTMLElement[];
    expect(cells.map((c) => c.getAttribute('data-dimension'))).toEqual(['policy', 'server', 'database', 'app', 'cloud']);
    expect(cells.map((c) => c.getAttribute('data-applies'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(cells[0].textContent).toContain('check_circle');
    expect(cells[2].textContent).toContain('cancel');
    expect(text()).toContain('COMPLIANCE.DETAIL.REASON_IS');
  });

  it('puts the evidence of the control inside the drawer, for this control, and lets only the company admin and the functional user upload it', () => {
    const panel = setup('admin_empresa');
    expect(fixture.nativeElement.querySelector('app-control-evidence')).not.toBeNull();
    expect(evidence.list).toHaveBeenCalledWith('c1', 'technical');
    expect(panel.canUploadEvidence()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('funcional').canUploadEvidence()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('auditor').canUploadEvidence()).toBeFalse();
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

  it('lets only the company admin edit and retire; the auditor and the functional user read', () => {
    expect(setup('admin_empresa').canEdit()).toBeTrue();
    expect(text()).toContain('COMPLIANCE.DETAIL.RETIRE');
    for (const role of ['auditor', 'funcional']) {
      TestBed.resetTestingModule();
      expect(setup(role).canEdit()).toBeFalse();
      expect(text()).not.toContain('COMPLIANCE.DETAIL.RETIRE');
    }
  });

  it('saves the interpretation at once with the text trimmed, shows the control already changed, and asks the list to refresh', () => {
    const panel = setup('admin_empresa');
    api.update.and.returnValue(of({ ...DETAIL, interpretation: { text: 'Se revisa cada trimestre.', is_customized: true } }));
    let changed = 0;
    panel.changed.subscribe(() => changed++);

    panel.startInterpretation();
    panel.interpretationDraft.set('  Se revisa cada trimestre.  ');
    panel.submitInterpretation();

    expect(api.update).toHaveBeenCalledWith('c1', { interpretation: { text: 'Se revisa cada trimestre.' } }, 'technical');
    expect(changed).toBe(1);
    expect(panel.mode()).toBe('view');
    expect(panel.detail()?.interpretation.text).toBe('Se revisa cada trimestre.');
    expect(panel.notice()).not.toBeNull();
  });

  it('does not send a dimension that does not apply without its reason', () => {
    const panel = setup('admin_empresa');
    panel.startDimensions();
    panel.toggleDimension(0, false);
    expect(panel.dimensionsValid()).toBeFalse();
    panel.submitDimensions();
    expect(api.update).not.toHaveBeenCalled();

    api.update.and.returnValue(of(DETAIL));
    panel.setReason(0, 'No usamos documentos.');
    panel.submitDimensions();
    expect(api.update).toHaveBeenCalledWith(
      'c1',
      {
        dimensions: [
          { dimension: 'policy', applies: false, reason_not_applicable: 'No usamos documentos.' },
          { dimension: 'database', applies: false, reason_not_applicable: 'No operamos bases de datos propias.' },
        ],
      },
      'technical',
    );
  });

  it('shows the 422 error of a field under that field and keeps the editor open', () => {
    const panel = setup('admin_empresa');
    const body = { message: 'validation.failed', error: { code: 'VALIDATION_FAILED', fields: [{ field: 'interpretation.text', code: 'string.max', message: 'Es demasiado largo.' }] } };
    api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: body })));

    panel.startInterpretation();
    panel.interpretationDraft.set('texto');
    panel.submitInterpretation();
    fixture.detectChanges();

    expect(panel.mode()).toBe('interpretation');
    expect(panel.fieldError('interpretation.text')).toBe('Es demasiado largo.');
    expect(text()).toContain('Es demasiado largo.');
  });

  it('asks for confirmation before retiring, sends nothing until confirmed, and then closes the drawer', () => {
    const panel = setup('admin_empresa');
    api.retire.and.returnValue(of(undefined));
    let changed = 0;
    let closed = 0;
    panel.changed.subscribe(() => changed++);
    panel.closed.subscribe(() => closed++);

    panel.askRetire();
    expect(panel.confirmingRetire()).toBeTrue();
    expect(api.retire).not.toHaveBeenCalled();

    panel.confirmRetire();
    expect(api.retire).toHaveBeenCalledWith('c1');
    expect(panel.confirmingRetire()).toBeFalse();
    expect(changed).toBe(1);
    expect(closed).toBe(1);
  });

  it('keeps the drawer open and says why when the control cannot be retired', () => {
    const panel = setup('admin_empresa');
    api.retire.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Este control ya fue dado de baja.' } })));
    panel.askRetire();
    panel.confirmRetire();
    fixture.detectChanges();
    expect(panel.error()).toBe('Este control ya fue dado de baja.');
    expect(panel.confirmingRetire()).toBeFalse();
  });

  describe('responsibles by dimension (users-team.md; off by default, D97)', () => {
    beforeEach(() => TestBed.overrideProvider(OWNER_ASSIGNMENT_ENABLED, { useValue: true }));
    const rows = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-test-responsible]'));

    it('shows nothing about owners while the feature is off', () => {
      TestBed.resetTestingModule();
      setup('admin_empresa');
      expect(fixture.nativeElement.querySelector('[data-test-responsibles]')).toBeNull();
      expect(api.responsibles).not.toHaveBeenCalled();
    });

    it('shows the company admin who owns each dimension and from where, and flags the ones without an owner', () => {
      setup('admin_empresa');
      expect(rows().map((r) => r.getAttribute('data-test-responsible'))).toEqual(['policy', 'cloud']);
      expect(rows()[0].textContent).toContain('Ana Ruiz');
      expect(rows()[0].textContent).toContain('COMPLIANCE.DETAIL.SOURCE_SERVICE');
      expect(rows()[1].querySelector('[data-test-unowned]')).not.toBeNull();
    });

    it('offers only the people who have that specialty, and lets the admin change or clear the exception', () => {
      const panel = setup('admin_empresa');
      const options = (d: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-test-responsible-select="${d}"] option`) as NodeListOf<HTMLOptionElement>).map((o) => o.value);
      expect(options('policy')).toEqual(['', 'ana', 'beto']);
      expect(options('cloud')).toEqual(['', 'beto']);

      api.setResponsible.and.returnValue(of({ dimension: 'cloud', tests_count: 1, owner: { id: 'beto', email: 'beto@acme.co', name: null, last_name: null }, source: 'control' }));
      let changed = 0;
      panel.changed.subscribe(() => changed++);
      panel.setResponsible('cloud', 'beto');
      fixture.detectChanges();
      expect(api.setResponsible).toHaveBeenCalledWith('c1', 'cloud', 'beto');
      expect(rows()[1].textContent).toContain('beto@acme.co');
      expect(rows()[1].textContent).toContain('COMPLIANCE.DETAIL.SOURCE_CONTROL');
      expect(changed).toBe(1);

      api.setResponsible.and.returnValue(of({ dimension: 'cloud', tests_count: 1, owner: null, source: null }));
      panel.setResponsible('cloud', '');
      expect(api.setResponsible).toHaveBeenCalledWith('c1', 'cloud', null);
    });

    it('lets the auditor read who owns what but not change it, and shows nothing to the functional user', () => {
      setup('auditor');
      expect(rows().length).toBe(2);
      expect(fixture.nativeElement.querySelector('[data-test-responsible-select]')).toBeNull();
      expect(api.candidates).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
      setup('funcional');
      expect(rows().length).toBe(0);
      expect(api.responsibles).not.toHaveBeenCalled();
    });
  });
});