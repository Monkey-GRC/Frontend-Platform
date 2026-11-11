import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { COMPLIANCE_SECTIONS, ComplianceServiceRef } from '@features/compliance/domain/models/compliance.models';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { ComplianceContextService } from '@features/compliance/domain/services/compliance-context.service';
import { ComplianceServicesService } from '@features/compliance/domain/services/compliance-services.service';
import { ComplianceShellView } from './compliance-shell';

const SERVICES: ComplianceServiceRef[] = [
  { id: 's1', name: 'Plataforma de facturación', frameworks: [{ code: 'soc2', status: 'active' }] },
  { id: 's2', name: 'Portal de clientes', frameworks: [{ code: 'soc2', status: 'active' }] },
];

describe('ComplianceShellView', () => {
  let fixture: ComponentFixture<ComplianceShellView>;
  let router: Router;
  let servicesApi: jasmine.SpyObj<ComplianceServicesService>;
  let query: BehaviorSubject<ParamMap>;

  function setup(role: string, list: ComplianceServiceRef[] | 'forbidden' = SERVICES, params: Record<string, string> = {}, activeId: string | null = 's1'): ComplianceShellView {
    query = new BehaviorSubject(convertToParamMap(params));
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
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    router = TestBed.inject(Router);
    TestBed.inject(ActiveComplianceService).set(activeId);
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

  it('shows the frameworks as plain labels, and as buttons to choose one only when the summary says there are several to choose from', () => {
    setup('admin_empresa', [{ ...SERVICES[0], frameworks: [{ code: 'soc2', status: 'active' }, { code: 'iso27001', status: 'active' }] }]);
    const context = TestBed.inject(ComplianceContextService);
    expect(fixture.nativeElement.querySelector('[data-framework-pick]')).toBeNull();
    context.selectable.set(true);
    context.selected.set('iso27001');
    fixture.detectChanges();
    const picks = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-framework-pick]'));
    expect(picks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    picks[0].click();
    expect(context.selected()).toBe('soc2');
  });

  it('shows the period of the evaluation next to the service when the summary gives it, and nothing when it does not', () => {
    setup('admin_empresa');
    const context = TestBed.inject(ComplianceContextService);
    expect(fixture.nativeElement.querySelector('[data-banner-period]')).toBeNull();
    context.evaluationText.set('Período 1 ene 2026 – 31 dic 2026');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-banner-period]').textContent).toContain('Período 1 ene 2026');
  });

  it('has no «back to the service» link in any section: the banner has no arrow and no link', () => {
    setup('admin_empresa');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('header a')).toBeNull();
    expect(root.querySelector('header [aria-label*="BACK"]')).toBeNull();
    expect(root.textContent).not.toContain('BACK_TO_SERVICE');
    expect(root.textContent).not.toContain('arrow_back');
  });

  it('is the compliance banner: the eyebrow, the open section as the title and the service, with the service selector inside it', () => {
    setup('admin_empresa');
    const root = fixture.nativeElement as HTMLElement;
    const banner = root.querySelector('header[data-compliance-banner]')!;
    expect(banner.classList).toContain('mk-banner');
    expect(banner.querySelector('[data-banner-eyebrow]')!.textContent).toContain('COMPLIANCE.SHELL.TITLE');
    expect(banner.querySelector('h1')!.textContent).toContain('COMPLIANCE.SECTIONS.SUMMARY');
    expect(banner.querySelector('[data-banner-service]')!.textContent).toContain('Plataforma de facturación');
    expect(banner.querySelector('#service-switch')).not.toBeNull();
  });

  it('shows the context line the open section publishes, and nothing when it has none', () => {
    setup('admin_empresa');
    const context = TestBed.inject(ComplianceContextService);
    expect(fixture.nativeElement.querySelector('[data-banner-insight]')).toBeNull();
    context.insight.set({ kind: 'count', labelKey: 'COMPLIANCE.BANNER.RISKS', count: 7 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-banner-insight]').textContent).toContain('COMPLIANCE.BANNER.RISKS');
    context.insight.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-banner-insight]')).toBeNull();
  });

  it('offers «Change period» in the banner only when the summary hands over the action, and runs it', () => {
    setup('admin_empresa');
    const context = TestBed.inject(ComplianceContextService);
    context.evaluationText.set('Período 1 ene 2026 – 31 dic 2026');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-edit-period]')).toBeNull();
    const open = jasmine.createSpy('open');
    context.editPeriod.set(open);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-edit-period]') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalled();
  });

  it('tells the summary that the header already shows the frameworks only when the service has some', () => {
    setup('admin_empresa');
    expect(TestBed.inject(ComplianceContextService).headerShowsFrameworks()).toBeTrue();
    TestBed.resetTestingModule();
    setup('admin_empresa', 'forbidden');
    expect(TestBed.inject(ComplianceContextService).headerShowsFrameworks()).toBeFalse();
  });

  it('offers to switch between services only when the company has more than one', () => {
    expect(setup('admin_empresa').canSwitch()).toBeTrue();
    expect(fixture.nativeElement.querySelector('#service-switch')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(setup('admin_empresa', [SERVICES[0]]).canSwitch()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#service-switch')).toBeNull();
  });

  it('switches service by remembering it as the active one, without navigating (the section stays and its page reloads on its own)', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    shell.switchTo('s2');
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s2');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing when the service picked is the current one', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    shell.switchTo('s1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes to the General view (all the services) from the selector', () => {
    const shell = setup('admin_empresa');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    shell.switchTo('general');
    expect(navigate).toHaveBeenCalledWith(['/', 'cumplimiento']);
  });

  it('falls back to the generic title when the list of services cannot be read, as for any role but the company admin', () => {
    const shell = setup('auditor', 'forbidden');
    expect(shell.current()).toBeNull();
    expect(shell.canSwitch()).toBeFalse();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('COMPLIANCE.SECTIONS.SUMMARY');
  });

  it('has the sections in the order of the GRC chain: risks, causes, controls, evidence, and the exclusions last', () => {
    expect(COMPLIANCE_SECTIONS.map((t) => t.path)).toEqual(['resumen', 'riesgos', 'causas', 'controles', 'evidencias', 'exclusiones']);
  });

  it('has no tab bar: the sections are pages of the menu, and the title of the page is the open section next to the active service', () => {
    setup('admin_empresa');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="tab"]')).toBeNull();
    expect(root.querySelector('[role="tablist"]')).toBeNull();
    expect(root.querySelector('h1')!.textContent).toContain('COMPLIANCE.SECTIONS.SUMMARY');
    expect(root.querySelector('header')!.textContent).toContain('Plataforma de facturación');
  });

  it('takes the first service of the list when none was chosen yet', () => {
    setup('admin_empresa', SERVICES, {}, null);
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s1');
  });

  it('takes the first service when the remembered one is not in the list any more', () => {
    setup('admin_empresa', SERVICES, {}, 'gone');
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s1');
  });

  it('sets as active the service a link brings in ?servicio= and takes the parameter out of the address', async () => {
    const navigate = spyOn(Router.prototype, 'navigate').and.resolveTo(true);
    setup('admin_empresa', SERVICES, { servicio: 's2' });
    await fixture.whenStable();
    expect(TestBed.inject(ActiveComplianceService).serviceId()).toBe('s2');
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { servicio: null }, replaceUrl: true }));
  });

  it('goes back to the entry when there is no service to show (nothing remembered and the list cannot be read)', () => {
    const navigate = spyOn(Router.prototype, 'navigate').and.resolveTo(true);
    setup('auditor', 'forbidden', {}, null);
    expect(navigate).toHaveBeenCalledWith(['/', 'cumplimiento'], { replaceUrl: true });
  });
});
