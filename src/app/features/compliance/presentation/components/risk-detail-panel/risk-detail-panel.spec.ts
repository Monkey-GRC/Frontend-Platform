import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Cause, RiskDetail } from '../../../domain/models/risk.models';
import { RiskService } from '../../../domain/services/risk.service';
import { RiskDetailPanel } from './risk-detail-panel';

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
    TestBed.configureTestingModule({ imports: [RiskDetailPanel], providers: [provideTranslateService(), { provide: RiskService, useValue: api }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(RiskDetailPanel);
    fixture.componentRef.setInput('riskId', detail.id);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

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
    expect(text()).toContain('COMPLIANCE.RISK_DETAIL.TREATMENT_NONE');
  });

  it('lets only the company admin manage, and only reads for the rest of the roles', () => {
    setup('admin_empresa');
    expect(text()).toContain('COMPLIANCE.RISK_DETAIL.LINK_CAUSE');
    for (const role of ['auditor', 'consultor', 'funcional']) {
      TestBed.resetTestingModule();
      setup(role);
      expect(text()).not.toContain('COMPLIANCE.RISK_DETAIL.LINK_CAUSE');
      expect(text()).not.toContain('COMPLIANCE.RISK_DETAIL.UNLINK');
    }
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
    expect(api.listAllCauses).toHaveBeenCalledWith('s1', undefined);
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
    expect(panel.notice()).not.toBeNull();
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
