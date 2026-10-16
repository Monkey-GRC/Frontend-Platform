import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ComplianceServiceRef } from '../../../domain/models/compliance.models';
import { ComplianceServicesService } from '../../../domain/services/compliance-services.service';
import { ComplianceShellView } from './compliance-shell';

const SERVICES: ComplianceServiceRef[] = [
  { id: 's1', name: 'Plataforma de facturación', frameworks: [{ code: 'soc2', status: 'active' }] },
  { id: 's2', name: 'Portal de clientes', frameworks: [{ code: 'soc2', status: 'active' }] },
];

describe('ComplianceShellView', () => {
  let fixture: ComponentFixture<ComplianceShellView>;
  let router: Router;
  let servicesApi: jasmine.SpyObj<ComplianceServicesService>;

  function setup(role: string, list: ComplianceServiceRef[] | 'forbidden' = SERVICES): ComplianceShellView {
    servicesApi = jasmine.createSpyObj<ComplianceServicesService>('ComplianceServicesService', ['list']);
    servicesApi.list.and.returnValue(list === 'forbidden' ? throwError(() => new HttpErrorResponse({ status: 403 })) : of(list));
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['frameworks']);
    catalogs.frameworks.and.returnValue(of([{ code: 'soc2', name: 'SOC 2', description: '', label: 'SOC 2', availability: 'available' }]));
    TestBed.configureTestingModule({
      imports: [ComplianceShellView],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ComplianceServicesService, useValue: servicesApi },
        { provide: CatalogService, useValue: catalogs },
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 's1' })) } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ComplianceShellView);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('says which service it is about and its framework, with the name of the framework from the catalog', () => {
    setup('admin_empresa');
    expect(text()).toContain('Plataforma de facturación');
    expect(text()).toContain('SOC 2');
  });

  it('offers to switch between services only when the company has more than one', () => {
    expect(setup('admin_empresa').canSwitch()).toBeTrue();
    expect(fixture.nativeElement.querySelector('#service-switch')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(setup('admin_empresa', [SERVICES[0]]).canSwitch()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#service-switch')).toBeNull();
  });

  it('keeps the current tab when it switches service', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/services/s1/cumplimiento/riesgos');
    shell.switchTo('s2');
    expect(navigate).toHaveBeenCalledWith(['/services', 's2', 'cumplimiento', 'riesgos']);
  });

  it('does nothing when the service picked is the current one', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/services/s1/cumplimiento');
    shell.switchTo('s1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to the generic title when the list of services cannot be read, as for any role but the company admin', () => {
    const shell = setup('auditor', 'forbidden');
    expect(shell.current()).toBeNull();
    expect(shell.canSwitch()).toBeFalse();
    expect(text()).toContain('COMPLIANCE.SHELL.TITLE');
  });

  it('has the five tabs in the order of the GRC chain: risks, causes, controls, evidence', () => {
    const shell = setup('admin_empresa');
    expect(shell.tabs.map((t) => t.path)).toEqual(['resumen', 'riesgos', 'causas', 'controles', 'evidencias']);
  });

  it('goes to the first real tab, Risks, when it switches service from a url with no tab', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/services/s1/cumplimiento');
    shell.switchTo('s2');
    expect(navigate).toHaveBeenCalledWith(['/services', 's2', 'cumplimiento', 'riesgos']);
  });
});
