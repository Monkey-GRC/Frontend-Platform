import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceService } from '@shared/domain/services/service.service';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { IntegrationAddView } from './integration-add';

const cat = (over: Partial<CatalogIntegration>): CatalogIntegration => ({
  code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', purpose: 'measurement', availability: 'available', description: 'Evalúa tu cuenta.', connection: { category: 'ac_01', platform: 'aws' }, connected: false, ...over,
});
const CATALOG = [
  cat({}),
  cat({ code: 'azure', name: 'Azure', logo_key: 'azure', availability: 'coming_soon', description: 'Evaluará tu suscripción.', connection: { category: 'ac_01', platform: 'azure' } }),
  cat({ code: 'gcp', name: 'Google Cloud', logo_key: 'gcp', connected: true, description: 'Evalúa tu proyecto.', connection: { category: 'ac_01', platform: 'gcp' } }),
  cat({ code: 'jira', name: 'Jira', logo_key: 'jira', purpose: 'workflow', availability: 'coming_soon', description: 'Tickets.', connection: null }),
];
const PURPOSES = [{ value: 'measurement', label: 'Medición' }, { value: 'workflow', label: 'Flujo de trabajo' }];
const SERVICE = { id: 's1', name: 'Pagos' } as ServiceListItem;

describe('IntegrationAddView', () => {
  let fixture: ComponentFixture<IntegrationAddView>;
  let router: Router;

  function setup(services: ServiceListItem[], purposes = PURPOSES): void {
    const api = jasmine.createSpyObj<IntegrationService>('IntegrationService', ['catalog']);
    api.catalog.and.returnValue(of(CATALOG));
    const svc = jasmine.createSpyObj<ServiceService>('ServiceService', ['list']);
    svc.list.and.returnValue(of({ items: services, page: 1, page_size: 50, total: services.length, total_pages: 1 }));
    const catalog = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalog.options.and.returnValue(of(purposes));
    TestBed.configureTestingModule({ imports: [IntegrationAddView], providers: [provideTranslateService(), provideRouter([]), { provide: IntegrationService, useValue: api }, { provide: ServiceService, useValue: svc }, { provide: CatalogService, useValue: catalog }] });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(IntegrationAddView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  it('groups the catalog in two numbered sections by purpose', () => {
    setup([SERVICE]);
    const sections = qa('section[data-purpose]');
    expect(sections.map((s) => s.getAttribute('data-purpose'))).toEqual(['measurement', 'workflow']);
    expect(sections[0].querySelectorAll('app-integration-card').length).toBe(3);
    expect(sections[1].querySelectorAll('app-integration-card').length).toBe(1);
    expect(sections[0].querySelector('h2')!.textContent).toContain('1.');
    expect(sections[1].querySelector('h2')!.textContent).toContain('2.');
  });

  it('shows the right footer: Connect only for an available, not connected one', () => {
    setup([SERVICE]);
    const cards = qa('app-integration-card');
    expect(cards[0].querySelector('[data-test-connect]')).not.toBeNull(); // aws
    expect(cards[1].querySelector('[data-test-connect]')).toBeNull(); // azure: coming soon
    expect(cards[1].textContent).toContain('INTEGRATIONS.ADD.COMING_SOON');
    const soon = cards[1].querySelector('[data-test-coming-soon]')!;
    expect(soon.className).toContain('border-dashed');
    expect(soon.className).toContain('bg-canvas');
    expect(cards[1].querySelector('app-card')).toBeNull(); // no hover surface
    expect(cards[0].querySelector('app-card')!.className).toContain('hover:border-action/60');
    expect(cards[1].querySelector('app-status-indicator[data-tone="neutral"]')).not.toBeNull();
    expect(cards[2].querySelector('[data-test-connect]')).toBeNull(); // gcp: connected, but another account can be connected
    expect(cards[2].textContent).toContain('INTEGRATIONS.ADD.CONNECTED');
    expect(cards[2].querySelector('[data-test-connect-another]')).not.toBeNull();
    expect(cards[1].querySelector('[data-test-connect-another]')).toBeNull();
    expect(cards[0].querySelector('[data-test-connect-another]')).toBeNull();
    expect(cards[3].querySelector('[data-test-connect]')).toBeNull(); // jira
  });

  it('filters by name or description', () => {
    setup([SERVICE]);
    fixture.componentInstance.query.set('suscripción');
    fixture.detectChanges();
    expect(qa('app-integration-card').length).toBe(1);
    expect(q('app-integration-card')!.textContent).toContain('Azure');
    fixture.componentInstance.query.set('zzz');
    fixture.detectChanges();
    expect(qa('app-integration-card').length).toBe(0);
  });

  it('asks for the service and navigates to the connection flow of the catalog connection', () => {
    setup([SERVICE]);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    q('[data-test-connect]')!.click();
    fixture.detectChanges();
    expect(qa('[data-test-service]').length).toBe(1);
    q('[data-test-service]')!.click();
    fixture.detectChanges();
    expect(nav).toHaveBeenCalledWith(['/services', 's1', 'connections', 'new', 'ac_01', 'aws']);
    expect(q('[data-test-service]')).toBeNull();
  });

  it('tells there are no services and links to them', () => {
    setup([]);
    q('[data-test-connect]')!.click();
    fixture.detectChanges();
    expect(q('[data-test-no-services] a')!.getAttribute('href')).toBe('/services');
    expect(q('[data-test-service]')).toBeNull();
  });

  it('lets connect another account of a connected integration through the same service modal', () => {
    setup([SERVICE]);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    q('[data-test-connect-another]')!.click();
    fixture.detectChanges();
    q('[data-test-service]')!.click();
    expect(nav).toHaveBeenCalledWith(['/services', 's1', 'connections', 'new', 'ac_01', 'gcp']);
  });

  it('makes the whole card a link to the detail, and the connect button does not open it', () => {
    setup([SERVICE]);
    const cards = qa('app-integration-card');
    expect(cards.map((c) => c.querySelector('a[data-test-open]')!.getAttribute('href'))).toEqual(['/integraciones/aws', '/integraciones/azure', '/integraciones/gcp', '/integraciones/jira']);
    expect(cards[0].className).toContain('relative');
    expect(cards[0].querySelector('a[data-test-open]')!.className).toContain('after:inset-0');
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = spyOn(event, 'stopPropagation').and.callThrough();
    cards[0].querySelector('[data-test-connect]')!.dispatchEvent(event);
    fixture.detectChanges();
    expect(stop).toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    expect(qa('[data-test-service]').length).toBe(1); // the modal opened instead
  });

  it('asks once on entering; the sections and their order and titles come from the integration_purpose catalog', () => {
    setup([SERVICE], [PURPOSES[1], PURPOSES[0]]);
    const api = TestBed.inject(IntegrationService) as jasmine.SpyObj<IntegrationService>;
    expect(api.catalog).toHaveBeenCalledTimes(1);
    expect((TestBed.inject(CatalogService) as jasmine.SpyObj<CatalogService>).options).toHaveBeenCalledWith('integration_purpose');
    const sections = qa('section[data-purpose]');
    expect(sections.map((x) => x.getAttribute('data-purpose'))).toEqual(['workflow', 'measurement']);
    expect(sections[0].querySelector('h2')!.textContent).toContain('1. Flujo de trabajo');
  });
});
