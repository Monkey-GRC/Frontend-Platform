import { provideRouter } from '@angular/router';
import { provideCatalogStub } from '@shared/testing/catalog-options';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError, Subject } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Cause, RiskDetail } from '@shared/domain/models/risk.models';
import { ResponsibleService } from '@features/compliance/domain/services/responsible.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { RiskDetailPanel } from './risk-detail-panel';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

const DETAIL: RiskDetail = {
  id: 'r1', service_id: 's1', code: 'R001', name: 'Acceso no autorizado', description: 'Personas acceden sin autorización.', trust_criterion: 'confidentiality',
  potential_impact: ['reputational'], origin: 'catalog', is_active: true, likelihood: null, impact: null, inherent_risk_value: null, inherent_risk_level: null, treatment: null,
  causes: [{ id: 'c1', code: 'F007', name: 'Cuentas sin dueño', failure_category: 'human_resource', controls: [{ control_id: 'k1', code: 'IAC-12', own_code: null, name: 'Gestión de accesos', is_mandatory: true, effect: null }] }],
};
const OWN: RiskDetail = { ...DETAIL, id: 'r9', origin: 'own' };

const cause = (id: string, active = true): Cause => ({ id, service_id: 's1', code: id.toUpperCase(), name: `Causa ${id}`, description: '', failure_category: 'processes', origin: 'catalog', is_active: active, risks: [], controls: [] });

describe('RiskDetailPanel', () => {
  let api: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<RiskDetailPanel>;

  function setup(role: string, detail: RiskDetail = DETAIL): RiskDetailPanel {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['getRisk', 'listAllCauses', 'linkCause', 'unlinkCause', 'deactivateRisk']);
    api.getRisk.and.returnValue(of(detail));
    api.listAllCauses.and.returnValue(of([cause('c1'), cause('c2'), cause('c3', false)]));
    TestBed.configureTestingModule({ imports: [RiskDetailPanel], providers: [provideCatalogStub(), provideTranslateService(), provideRouter([]), { provide: RiskService, useValue: api }, { provide: ResponsibleService, useValue: jasmine.createSpyObj<ResponsibleService>('ResponsibleService', ['list']) }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(RiskDetailPanel);
    fixture.componentRef.setInput('riskId', detail.id);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('ignores a slow answer that arrives after a newer load (MD-499)', () => {
    const panel = setup('admin_empresa');
    const slow = new Subject<NonNullable<ReturnType<typeof panel.detail>>>();
    const current = panel.detail()!;
    api.getRisk.and.returnValues(slow as never, of({ ...current, code: 'NEW-1' }) as never);
    panel.load();
    panel.load();
    slow.next({ ...current, code: 'OLD-9' });
    expect(panel.detail()!.code).toBe('NEW-1');
  });

  it('forgets the search, the filter, the expanded causes and the picker of the previous risk when another one is opened', () => {
    const panel = setup('admin_empresa', OWN);
    panel.causeList.search('x');
    panel.causeList.goTo(2);
    (panel as unknown as { setOnlyWithout(v: boolean): void }).setOnlyWithout(true);
    (panel as unknown as { toggleControls(id: string): void }).toggleControls('c1');
    panel.startLink();
    panel.askRemove();
    api.getRisk.and.returnValue(of(DETAIL));
    fixture.componentRef.setInput('riskId', 'r1');
    fixture.detectChanges();
    expect(panel.causeList.query()).toBe('');
    expect(panel.causeList.page()).toBe(1);
    expect(panel.onlyWithoutControls()).toBeFalse();
    expect((panel as unknown as { isExpanded(id: string): boolean }).isExpanded('c1')).toBeFalse();
    expect(panel.picking()).toBeFalse();
    expect(panel.confirmingRemove()).toBeFalse();
  });

  it('shows the risk with its code, its causes, the controls that mitigate them and the control code', () => {
    setup('admin_empresa');
    expect(text()).toContain('R001');
    expect(text()).toContain('Cuentas sin dueño');
    expect(text()).toContain('IAC-12');
    expect(text()).toContain('Gestión de accesos');
  });

  it('shows a risk that has not been evaluated as such and says there is no treatment yet', () => {
    setup('admin_empresa');
    expect(text()).toContain('COMPLIANCE.RISKS.NOT_EVALUATED');
    expect(text()).toContain('COMPLIANCE.RISK_ASSESSMENT.TREATMENT_NONE');
  });

  it('lets only the company admin manage, and only reads for the rest of the roles', () => {
    setup('admin_empresa');
    expect(text()).toContain('COMPLIANCE.RISK_DETAIL.LINK_CAUSE');
    for (const role of ['auditor', 'responsable', 'delegado']) {
      TestBed.resetTestingModule();
      setup(role);
      expect(text()).not.toContain('COMPLIANCE.RISK_DETAIL.LINK_CAUSE');
      expect(text()).not.toContain('COMPLIANCE.RISK_DETAIL.UNLINK');
    }
  });

  it('offers to edit only a risk of the company, and asks the view to open the form with it', () => {
    setup('admin_empresa', DETAIL);
    expect(fixture.nativeElement.querySelector('[data-edit]')).toBeNull();
    TestBed.resetTestingModule();
    const panel = setup('admin_empresa', OWN);
    const asked: RiskDetail[] = [];
    panel.edit.subscribe((r) => asked.push(r));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-edit]')!.click();
    expect(asked).toEqual([OWN]);
  });

  it('offers to retire only a risk of the company, never one of the catalog', () => {
    expect(setup('admin_empresa', DETAIL).canRemove()).toBeFalse();
    TestBed.resetTestingModule();
    expect(setup('admin_empresa', OWN).canRemove()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup('auditor', OWN).canRemove()).toBeFalse();
  });

  it('offers only the causes that are active and not linked yet', () => {
    const panel = setup('admin_empresa');
    panel.startLink();
    expect(api.listAllCauses).toHaveBeenCalledWith('s1', 'technical');
    expect(panel.candidates().map((c) => c.id)).toEqual(['c2']);
  });

  it('links the cause that is picked, reloads the risk and asks the list to refresh', () => {
    const panel = setup('admin_empresa');
    api.linkCause.and.returnValue(of(undefined));
    let changed = 0;
    panel.changed.subscribe(() => changed++);
    panel.startLink();
    panel.link('c2');
    expect(api.linkCause).toHaveBeenCalledWith('r1', 'c2');
    expect(panel.picking()).toBeFalse();
    expect(toastText()).not.toBe('');
    expect(api.getRisk).toHaveBeenCalledTimes(2);
    expect(changed).toBe(1);
  });

  it('shows the message of the backend when the link already exists and keeps the picker open', () => {
    const panel = setup('admin_empresa');
    api.linkCause.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ese vínculo ya existe.', error: { code: 'LINK_ALREADY_EXISTS' } } })));
    panel.startLink();
    panel.link('c2');
    fixture.detectChanges();
    expect(panel.error()).toBe('Ese vínculo ya existe.');
    expect(panel.picking()).toBeTrue();
    expect(text()).toContain('Ese vínculo ya existe.');
  });

  it('asks for confirmation before removing a link and sends nothing until confirmed', () => {
    const panel = setup('admin_empresa');
    api.unlinkCause.and.returnValue(of(undefined));
    panel.askUnlink(DETAIL.causes[0]);
    expect(panel.unlinking()).toBe(DETAIL.causes[0]);
    expect(api.unlinkCause).not.toHaveBeenCalled();
    panel.confirmUnlink();
    expect(api.unlinkCause).toHaveBeenCalledWith('r1', 'c1');
    expect(panel.unlinking()).toBeNull();
  });

  it('retires an own risk after confirming, closes the panel and refreshes the list', () => {
    const panel = setup('admin_empresa', OWN);
    api.deactivateRisk.and.returnValue(of(undefined));
    let closed = 0, changed = 0;
    panel.closed.subscribe(() => closed++);
    panel.changed.subscribe(() => changed++);
    panel.askRemove();
    expect(api.deactivateRisk).not.toHaveBeenCalled();
    panel.confirmRemove();
    expect(api.deactivateRisk).toHaveBeenCalledWith('r9');
    expect(closed).toBe(1);
    expect(changed).toBe(1);
  });
});
