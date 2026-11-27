import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { NEVER, of, throwError, Subject } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlDetail, ControlDimension } from '@features/compliance/domain/models/control.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { ControlDetailPanel } from './control-detail-panel';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

const DIMENSIONS: ControlDimension[] = ['policy', 'server', 'database', 'app', 'cloud', 'network', 'endpoint', 'physical', 'process'];

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
  owner: null, executor: null, management_state: 'non_compliant', management: { owner_approved_by: null, owner_approved_at: null, approved_by: null, approved_at: null, returned_reason: null, returned_by: null, returned_at: null, allowed_actions: [], level: null, level_override: null, exceptions: [], requirements: [], manual_tests: [] },
  interpretation: { text: 'Los accesos se otorgan con el formulario de TI.', is_customized: false },
  dimensions: [
    { dimension: 'policy', applies: true, type: 'manual', reason_not_applicable: null },
    { dimension: 'database', applies: false, type: null, reason_not_applicable: 'No operamos bases de datos propias.' },
  ],
  evidence: [],
  causes: [],
  failing: [],
};

describe('ControlDetailPanel', () => {
  let api: jasmine.SpyObj<ControlService>;
  let evidence: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlDetailPanel>;

  function setup(role: string, detail: ControlDetail = DETAIL): ControlDetailPanel {
    api = jasmine.createSpyObj<ControlService>('ControlService', ['get', 'update', 'retire']);
    api.get.and.returnValue(of(detail));
    evidence = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listForTest', 'upload', 'download']);
    evidence.list.and.returnValue(NEVER);
    evidence.listForTest.and.returnValue(NEVER);
    TestBed.configureTestingModule({ imports: [ControlDetailPanel], providers: [provideTranslateService(), provideRouter([]), { provide: ControlManagementService, useValue: { history: () => NEVER, listOccurrences: () => of([]), assignees: () => of([]) } }, { provide: CatalogService, useValue: { options: () => of(DIMENSIONS.map((value) => ({ value, label: `L-${value}` }))) } }, { provide: ControlService, useValue: api }, { provide: EvidenceService, useValue: evidence }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlDetailPanel);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('ignores a slow answer that arrives after a newer load (MD-499)', () => {
    const panel = setup('admin_empresa');
    const slow = new Subject<NonNullable<ReturnType<typeof panel.detail>>>();
    const current = panel.detail()!;
    api.get.and.returnValues(slow as never, of({ ...current, code: 'NEW-1' }) as never);
    panel.load();
    panel.load();
    slow.next({ ...current, code: 'OLD-9' });
    expect(panel.detail()!.code).toBe('NEW-1');
  });

  it('drops the draft, the edit mode, the search and the confirmation of the previous control when another one is opened', () => {
    const panel = setup('admin_empresa');
    panel.startInterpretation();
    panel.interpretationDraft.set('Borrador a medio escribir');
    panel.periodicityOpen.set(true);
    panel.causeList.search('x');
    panel.askRemove();
    expect(panel.editing()).toBeTrue();
    api.get.and.returnValue(of({ ...DETAIL, id: 'c2' }));
    fixture.componentRef.setInput('controlId', 'c2');
    fixture.detectChanges();
    expect(api.get).toHaveBeenCalledWith('c2', 'technical');
    expect(panel.mode()).toBe('view');
    expect(panel.interpretationDraft()).toBe('');
    expect(panel.periodicityOpen()).toBeFalse();
    expect(panel.causeList.query()).toBe('');
    expect(panel.confirmingRemove()).toBeFalse();
    expect(panel.editing()).toBeFalse();
  });

  it('asks for the technical view for the company admin and the auditor, and the business view for the owner and the delegate', () => {
    setup('admin_empresa');
    expect(api.get).toHaveBeenCalledWith('c1', 'technical');
    TestBed.resetTestingModule();
    setup('auditor');
    expect(api.get).toHaveBeenCalledWith('c1', 'technical');
    TestBed.resetTestingModule();
    setup('responsable');
    expect(api.get).toHaveBeenCalledWith('c1', undefined);
  });

  it('shows the code and the requirements it covers next to the name, and the percentages', () => {
    setup('admin_empresa', { ...DETAIL, code: 'IAC-12', requirement_codes: ['CC6.1'], progress: { done: 3, total: 5 }, coverage: { measured: 4, applicable: 5 } });
    expect(text()).toContain('IAC-12');
    expect(text()).toContain('CC6.1');
    expect(fixture.nativeElement.querySelector('[data-test-score]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-donut')).not.toBeNull();
  });

  it('shows the nine dimensions in the catalog order with their word (applies or not), also when the control has no test for them', () => {
    setup('admin_empresa');
    const cells = Array.from(fixture.nativeElement.querySelectorAll('[data-dimension]')) as HTMLElement[];
    expect(cells.map((c) => c.getAttribute('data-dimension'))).toEqual(DIMENSIONS);
    expect(cells.map((c) => c.getAttribute('data-applies'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false']);
    expect(cells[0].textContent).toContain('COMPLIANCE.DETAIL.APPLIES');
    expect(cells[0].querySelector('[data-tone="ok"]')).not.toBeNull();
    expect(cells[2].textContent).toContain('COMPLIANCE.DETAIL.NOT_APPLIES');
    expect(cells[2].querySelector('[data-tone="neutral"]')).not.toBeNull();
    expect(text()).toContain('COMPLIANCE.DETAIL.REASON_IS');
  });

  it('opens in the wide detail modal: the name as the title, the codes and the score in the fixed header, and «Cerrar» and «Dar de baja» in the footer (MD-499)', () => {
    setup('admin_empresa', { ...DETAIL, requirement_codes: ['CC6.1'] });
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(el.querySelector('#' + dialog.getAttribute('aria-labelledby'))?.textContent).toContain('Gestión de accesos');
    const header = dialog.querySelector('header')!;
    expect(header.textContent).toContain('IAC-12');
    expect(header.textContent).toContain('CC6.1');
    expect(header.querySelector('[data-test-score]')).not.toBeNull();
    expect(dialog.querySelector('footer [data-detail-close]')).not.toBeNull();
    expect(dialog.querySelector('footer [data-retire]')).not.toBeNull();
    expect(el.querySelector('aside')).toBeNull();
  });

  it('takes the open tab from the address and tells the view when it changes', () => {
    const panel = setup('admin_empresa', { ...DETAIL, technical: TECH });
    const changes: string[] = [];
    panel.tabChange.subscribe((t) => changes.push(t));
    fixture.componentRef.setInput('requestedTab', 'requirements');
    fixture.detectChanges();
    expect(panel.activeTab()).toBe('requirements');
    panel.selectTab('evidence');
    expect(changes).toEqual(['evidence']);
    fixture.componentRef.setInput('requestedTab', 'nope');
    fixture.detectChanges();
    expect(panel.activeTab()).toBe('summary');
  });

  const tabIds = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((t) => t.id.replace('detail-tab-', ''));
  const TECH = { points_of_focus: ['PF-1'], level: 'partial' as const, level_value: 3, complies: false, c_percent: 50, requirements: [] };

  it('shows Summary, Requirements and tests, Evidence and Approval in the technical view, and Period only when the audited period is defined', () => {
    setup('admin_empresa', { ...DETAIL, technical: TECH });
    expect(tabIds()).toEqual(['summary', 'requirements', 'evidence', 'approval']);
    TestBed.resetTestingModule();
    setup('admin_empresa', { ...DETAIL, technical: { ...TECH, period: { level: 'weak', complies: false, windows: { total: 2, with_evidence: 1 }, missing: [] } } });
    expect(tabIds()).toEqual(['summary', 'requirements', 'evidence', 'approval', 'period']);
    expect(fixture.nativeElement.querySelector('app-control-period')).not.toBeNull();
  });

  it('shows only Summary, Evidence and Approval in the business view, without level or requirements', () => {
    setup('responsable');
    expect(tabIds()).toEqual(['summary', 'evidence', 'approval']);
    expect(fixture.nativeElement.querySelector('[data-test-level]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-control-requirements')).toBeNull();
  });

  it('reloads the control without emptying the panel and tells the list after an approval action', () => {
    const panel = setup('responsable');
    let changed = 0;
    panel.changed.subscribe(() => changed++);
    api.get.calls.reset();
    api.get.and.returnValue(of({ ...DETAIL, management_state: 'owner_approved' }));
    panel.reloadDetail();
    expect(api.get).toHaveBeenCalledOnceWith('c1', undefined);
    expect(panel.stage()).toBe('ready');
    expect(panel.detail()!.management_state).toBe('owner_approved');
    expect(changed).toBe(1);
  });

  it('shows the progress bar while the control reloads after an act, and clears it when it arrives or fails', () => {
    const panel = setup('responsable');
    const answer = new Subject<ControlDetail>();
    api.get.and.returnValue(answer as never);
    panel.selectTab('approval');
    panel.reloadDetail();
    fixture.detectChanges();
    expect(panel.refreshing()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-tab="approval"] app-skeleton-region')?.getAttribute('aria-busy')).toBe('true');
    const bar = () => fixture.nativeElement.querySelector('[data-tab="approval"] > app-skeleton-region > [data-load-progress]');
    expect(bar()).not.toBeNull();
    answer.next({ ...DETAIL });
    fixture.detectChanges();
    expect(panel.refreshing()).toBeFalse();
    expect(bar()).toBeNull();
    api.get.and.returnValue(throwError(() => new Error('x')) as never);
    panel.reloadDetail();
    expect(panel.refreshing()).toBeFalse();
  });

  it('reloads the detail (and tells the list) when evidence is uploaded; a failed reload clears on retry', () => {
    const panel = setup('responsable');
    let changed = 0;
    panel.changed.subscribe(() => changed++);
    api.get.calls.reset();
    api.get.and.returnValue(throwError(() => new Error('x')) as never);
    panel.reloadDetail();
    fixture.detectChanges();
    expect(panel.refreshFailed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-refresh-retry]')).not.toBeNull();
    api.get.and.returnValue(of({ ...DETAIL }));
    fixture.nativeElement.querySelector('[data-refresh-retry]').click();
    fixture.detectChanges();
    expect(panel.refreshFailed()).toBeFalse();
    expect(panel.error()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-refresh-retry]')).toBeNull();
    expect(changed).toBe(2);
  });

  it('changes to the Evidence tab from a requirement with cases without evidence', () => {
    const panel = setup('responsable');
    panel.selectTab('approval');
    panel.goToEvidence();
    expect(panel.activeTab()).toBe('evidence');
  });

  it('discards an older refresh that arrives after a newer one, and warns when the refresh fails', () => {
    const panel = setup('responsable');
    const old = new Subject<ControlDetail>();
    const fresh = new Subject<ControlDetail>();
    api.get.and.returnValues(old as never, fresh as never);
    panel.reloadDetail();
    panel.reloadDetail();
    fresh.next({ ...DETAIL, code: 'NEW-1' });
    old.next({ ...DETAIL, code: 'OLD-9' });
    expect(panel.detail()!.code).toBe('NEW-1');
    api.get.and.returnValue(throwError(() => new Error('x')) as never);
    panel.reloadDetail();
    expect(panel.error()).toContain('COMPLIANCE.APPROVAL.REFRESH_ERROR');
  });

  it('mounts the Approval tab (and its history) only when that tab is open', () => {
    const panel = setup('responsable');
    expect(fixture.nativeElement.querySelector('app-control-approval')).toBeNull();
    panel.selectTab('approval');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-control-approval')).not.toBeNull();
    panel.selectTab('summary');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-control-approval')).toBeNull();
  });

  it('shows one tab at a time and keeps a half-written interpretation when switching tabs', () => {
    const panel = setup('admin_empresa', { ...DETAIL, technical: TECH });
    const tab = (id: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-tab="${id}"]`)!;
    expect(tab('summary').hidden).toBeFalse();
    expect(tab('evidence').hidden).toBeTrue();
    panel.startInterpretation();
    panel.interpretationDraft.set('Otra lectura.');
    panel.selectTab('evidence');
    fixture.detectChanges();
    expect(tab('summary').hidden).toBeTrue();
    expect(tab('evidence').hidden).toBeFalse();
    expect(panel.editing()).toBeTrue();
    panel.selectTab('summary');
    fixture.detectChanges();
    expect(panel.interpretationDraft()).toBe('Otra lectura.');
    expect(panel.activeTab()).toBe('summary');
  });

  it('lists the causes in a searchable table and a click on a row opens that cause', () => {
    const panel = setup('admin_empresa', { ...DETAIL, causes: [{ id: 'k1', code: 'F007', name: 'Cuentas sin dueño' }, { id: 'k2', code: 'F008', name: 'Claves viejas' }] });
    const opened: string[] = [];
    panel.openCause.subscribe((id) => opened.push(id));
    const rows = () => Array.from(fixture.nativeElement.querySelectorAll('[data-cause-link] tbody tr')) as HTMLElement[];
    expect(rows().length).toBe(2);
    (rows()[0] as HTMLElement).click();
    expect(opened).toEqual(['k1']);
    panel.causeList.search('claves');
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('F008');
  });

  it('puts the evidence of the control inside the detail, for this control, and lets only the company admin and the owner and the delegate upload it', () => {
    const panel = setup('admin_empresa');
    expect(fixture.nativeElement.querySelector('app-control-evidence')).not.toBeNull();
    expect(evidence.list).toHaveBeenCalledWith('c1', 'technical');
    expect(panel.canUploadEvidence()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('responsable').canUploadEvidence()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('auditor').canUploadEvidence()).toBeFalse();
  });

  it('shows to the company admin every test of the control, next to the evidence it asks for', () => {
    setup('admin_empresa', {
      ...DETAIL,
      technical: {
        points_of_focus: [],
        
        
        tests: [
          { test_id: 't-doc-1', test_code: 'T-DOC-001', display_name: 'Revisión de diseño de la política', dimension: 'policy', status: 'pending', accepts_evidence: true, evidence_fallback: false },
          { test_id: 't-srv-1', test_code: 'T-SRV-001', display_name: 'Configuración de servidores', dimension: 'server', status: 'pending', accepts_evidence: false, evidence_fallback: false },
        ],
      },
    });
    expect(text()).toContain('COMPLIANCE.DETAIL_TABS.EVIDENCE');
    expect(fixture.nativeElement.querySelectorAll('[data-evidence-help]').length).toBe(1);
    expect(text()).toContain('T-DOC-001');
    expect(text()).toContain('Configuración de servidores');
    expect(fixture.nativeElement.querySelector('app-control-evidence')).not.toBeNull();
  });

  it('only says how many tests the control has when the view brings no list, as for the owner and the delegate', () => {
    setup('responsable');
    expect(text()).toContain('COMPLIANCE.TESTS.COUNT_ONLY');
    expect(fixture.nativeElement.querySelector('[data-test-state]')).toBeNull();
  });

  it('lets only the company admin edit and retire; the auditor and the owner and the delegate read', () => {
    expect(setup('admin_empresa').canEdit()).toBeTrue();
    expect(text()).toContain('COMPLIANCE.DETAIL.RETIRE');
    for (const role of ['auditor', 'responsable', 'delegado']) {
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
    expect(toastText()).toContain('COMPLIANCE.DETAIL.SAVED');
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
        ],
      },
      'technical',
    );
  });

  it('offers the nine dimensions to edit and lets the admin turn on one the detail has no row for', () => {
    const panel = setup('admin_empresa');
    panel.startDimensions();
    expect(panel.dimensionsDraft().map((d) => d.dimension)).toEqual(DIMENSIONS);
    expect(panel.dimensionsValid()).toBeFalse();
    api.update.and.returnValue(of(DETAIL));
    panel.toggleDimension(DIMENSIONS.indexOf('network'), true);
    expect(panel.dimensionsValid()).toBeTrue();
    panel.submitDimensions();
    expect(api.update).toHaveBeenCalledWith('c1', { dimensions: [{ dimension: 'network', applies: true }] }, 'technical');
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

  it('asks for confirmation before retiring, sends nothing until confirmed, and then closes the detail', () => {
    const panel = setup('admin_empresa');
    api.retire.and.returnValue(of(undefined));
    let changed = 0;
    let closed = 0;
    panel.changed.subscribe(() => changed++);
    panel.closed.subscribe(() => closed++);

    panel.askRemove();
    expect(panel.confirmingRemove()).toBeTrue();
    expect(api.retire).not.toHaveBeenCalled();

    panel.confirmRemove();
    expect(api.retire).toHaveBeenCalledWith('c1');
    expect(panel.confirmingRemove()).toBeFalse();
    expect(changed).toBe(1);
    expect(closed).toBe(1);
  });

  it('keeps the detail open and says why when the control cannot be retired', () => {
    const panel = setup('admin_empresa');
    api.retire.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Este control ya fue dado de baja.' } })));
    panel.askRemove();
    panel.confirmRemove();
    fixture.detectChanges();
    expect(panel.error()).toBe('Este control ya fue dado de baja.');
    expect(panel.confirmingRemove()).toBeFalse();
  });

  it('guards the detail while the interpretation or the dimensions differ from what is saved (MD-485)', () => {
    const panel = setup('admin_empresa');
    expect(panel.editing()).toBeFalse();
    panel.startInterpretation();
    expect(panel.editing()).toBeFalse();
    panel.interpretationDraft.set('Otra lectura del control.');
    expect(panel.editing()).toBeTrue();
    panel.cancelEdit();
    expect(panel.editing()).toBeFalse();
    panel.startDimensions();
    expect(panel.editing()).toBeFalse();
    panel.setReason(0, 'No aplica por ahora');
    expect(panel.editing()).toBeTrue();
  });

  describe('periodicity (G-10, D147)', () => {
    const REQ = { id: 'r1', code: 'IAC-12-L2', text: 'x', type: 'operational', periodicity: 'monthly' as const, suggested_periodicity: 'quarterly' as const, periodicity_source: 'client' as const, status: 'compliant' as const, tests: [] };
    const withReqs = (patch: Partial<ControlDetail> = {}): ControlDetail => ({ ...DETAIL, ...patch, technical: { ...TECH, requirements: [REQ], periodicity_change: { periodicity: 'monthly', justification: 'Contrato con el banco', changed_at: '2026-11-20T10:00:00Z' } } });
    const change = () => fixture.nativeElement.querySelector('[data-change-periodicity]') as HTMLButtonElement | null;

    it('shows the current and the suggested periodicity and the last change to the company admin and the auditor', () => {
      setup('auditor', withReqs());
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-periodicity-current]')!.textContent).toContain('monthly');
      expect(el.querySelector('[data-periodicity-suggested]')!.textContent).toContain('quarterly');
      expect(el.querySelector('[data-periodicity-change]')!.textContent).toContain('COMPLIANCE.PERIODICITY_CHANGE.LAST_REASON');
    });

    it('offers «Cambiar periodicidad» only to the company admin', () => {
      setup('admin_empresa', withReqs());
      expect(change()).not.toBeNull();
      TestBed.resetTestingModule();
      setup('auditor', withReqs());
      expect(change()).toBeNull();
    });

    it('does not offer it in a control of the organization (it has no catalog requirements)', () => {
      setup('admin_empresa', withReqs({ origin: 'own' }));
      expect(change()).toBeNull();
    });

    it('opens the form, and after saving reloads the detail, closes it, tells the list and shows a toast', () => {
      const panel = setup('admin_empresa', withReqs());
      const changed = jasmine.createSpy('changed');
      panel.changed.subscribe(changed);
      change()!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-control-periodicity-form')).not.toBeNull();
      const next = withReqs({ name: 'Recalculado' });
      panel.onPeriodicitySaved(next);
      fixture.detectChanges();
      expect(panel.detail()).toBe(next);
      expect(fixture.nativeElement.querySelector('app-control-periodicity-form')).toBeNull();
      expect(changed).toHaveBeenCalledTimes(1);
      expect(toastText()).toContain('COMPLIANCE.PERIODICITY_CHANGE.SAVED');
    });
  });
});
