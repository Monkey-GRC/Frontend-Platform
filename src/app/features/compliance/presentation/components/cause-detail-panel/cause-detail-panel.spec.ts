import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlListItem } from '@features/compliance/domain/models/control.models';
import { Cause } from '@shared/domain/models/risk.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { CauseDetailPanel } from './cause-detail-panel';

const DETAIL: Cause = {
  id: 'c1', service_id: 's1', code: 'F007', name: 'Cuentas sin dueño', description: 'Siguen activas.', failure_category: 'human_resource', origin: 'catalog', is_active: true,
  risks: [{ id: 'r1', code: 'R001', name: 'Acceso no autorizado' }],
  controls: [{ control_id: 'k1', code: 'IAC-12', own_code: null, name: 'Gestión de accesos', is_mandatory: true, effect: null }],
};
const OWN: Cause = { ...DETAIL, id: 'c9', origin: 'own' };

const control = (id: string, code: string, name: string): ControlListItem => ({
  id, code, requirement_codes: [], own_code: null, name, origin: 'catalog', type: 'manual', trust_criteria: ['security'], approval: 'approved', readiness: 'not_measured',
  progress: { done: 0, total: 1 }, coverage: { measured: 0, applicable: 1 }, assigned_to: null,
});

describe('CauseDetailPanel', () => {
  let api: jasmine.SpyObj<RiskService>;
  let controls: jasmine.SpyObj<ControlService>;
  let fixture: ComponentFixture<CauseDetailPanel>;

  function setup(role: string, detail: Cause = DETAIL): CauseDetailPanel {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['getCause', 'linkControl', 'unlinkControl', 'deactivateCause']);
    api.getCause.and.returnValue(of(detail));
    controls = jasmine.createSpyObj<ControlService>('ControlService', ['listAll']);
    controls.listAll.and.returnValue(of([control('k1', 'IAC-12', 'Gestión de accesos'), control('k2', 'MON-3', 'Monitoreo continuo')]));
    TestBed.configureTestingModule({
      imports: [CauseDetailPanel],
      providers: [provideTranslateService(), { provide: RiskService, useValue: api }, { provide: ControlService, useValue: controls }],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(CauseDetailPanel);
    fixture.componentRef.setInput('causeId', detail.id);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows the cause with the risks it originates and the controls that mitigate it, with their codes', () => {
    setup('admin_empresa');
    expect(text()).toContain('F007');
    expect(text()).toContain('R001');
    expect(text()).toContain('IAC-12');
  });

  it('lets only the company admin link and remove controls', () => {
    setup('admin_empresa');
    expect(text()).toContain('COMPLIANCE.CAUSE_DETAIL.LINK_CONTROL');
    for (const role of ['auditor', 'responsable', 'delegado']) {
      TestBed.resetTestingModule();
      setup(role);
      expect(text()).not.toContain('COMPLIANCE.CAUSE_DETAIL.LINK_CONTROL');
      expect(text()).not.toContain('COMPLIANCE.CAUSE_DETAIL.UNLINK');
    }
  });

  it('offers only the controls that are not linked yet, with their code in the label', () => {
    const panel = setup('admin_empresa');
    panel.startLink();
    expect(controls.listAll).toHaveBeenCalledWith('s1', 'technical');
    expect(panel.candidates()).toEqual([{ id: 'k2', label: 'MON-3 · Monitoreo continuo' }]);
  });

  it('links the control that is picked, reloads and asks the list to refresh', () => {
    const panel = setup('admin_empresa');
    api.linkControl.and.returnValue(of({ cause_id: 'c1', control_id: 'k2', is_mandatory: true, effect: null }));
    let changed = 0;
    panel.changed.subscribe(() => changed++);
    panel.startLink();
    panel.link('k2');
    expect(api.linkControl).toHaveBeenCalledWith('c1', 'k2');
    expect(api.getCause).toHaveBeenCalledTimes(2);
    expect(changed).toBe(1);
    expect(panel.picking()).toBeFalse();
  });

  it('shows the message of the backend when the cause was retired meanwhile', () => {
    const panel = setup('admin_empresa');
    api.linkControl.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'La causa está dada de baja.', error: { code: 'CAUSE_INACTIVE' } } })));
    panel.startLink();
    panel.link('k2');
    expect(panel.error()).toBe('La causa está dada de baja.');
  });

  it('asks for confirmation before unlinking a control', () => {
    const panel = setup('admin_empresa');
    api.unlinkControl.and.returnValue(of(undefined));
    panel.askUnlink(DETAIL.controls[0]);
    expect(api.unlinkControl).not.toHaveBeenCalled();
    panel.confirmUnlink();
    expect(api.unlinkControl).toHaveBeenCalledWith('c1', 'k1');
  });

  it('offers to retire only a cause of the company, never one of the catalog', () => {
    expect(setup('admin_empresa', DETAIL).canRemove()).toBeFalse();
    TestBed.resetTestingModule();
    const own = setup('admin_empresa', OWN);
    expect(own.canRemove()).toBeTrue();
    api.deactivateCause.and.returnValue(of(undefined));
    let closed = 0;
    own.closed.subscribe(() => closed++);
    own.confirmRemove();
    expect(api.deactivateCause).toHaveBeenCalledWith('c9');
    expect(closed).toBe(1);
  });
});
