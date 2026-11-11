import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '@core/domain/services/auth.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { ServicesListView } from './services-list';

const READY: ServiceListItem = {
  id: 's1', name: 'Soporte', type: 'service_desk', is_complete: true, frameworks: [{ code: 'soc2', status: 'active' }],
  catalog: { status: 'ready', cloned_controls: 118 }, technical_control: { is_complete: true, connection_count: 2 }, created_at: '2026-01-01',
};
const PREPARING: ServiceListItem = {
  id: 's2', name: 'Pagos', type: 'payments', is_complete: true, frameworks: [{ code: 'iso27001', status: 'paused' }],
  catalog: { status: 'processing', cloned_controls: 0 }, technical_control: { is_complete: false, connection_count: 0 }, created_at: '2026-01-02',
};

describe('ServicesListView', () => {
  let api: jasmine.SpyObj<ServiceService>;
  let fixture: ComponentFixture<ServicesListView>;

  function setup(items: ServiceListItem[]): void {
    api = jasmine.createSpyObj<ServiceService>('ServiceService', ['list', 'remove']);
    api.list.and.returnValue(of({ items, page: 1, page_size: 50, total: items.length, total_pages: 1 }));
    api.remove.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [ServicesListView],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: ServiceService, useValue: api },
        { provide: CatalogService, useValue: { options: () => of([{ value: 'service_desk', label: 'Mesa de ayuda' }]), frameworks: () => of([{ code: 'soc2', name: 'SOC 2', description: '', label: 'Catalog SOC 2', availability: 'available' }]) } },
        { provide: AuthService, useValue: { validate: () => of(true) } },
      ],
    });
    fixture = TestBed.createComponent(ServicesListView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const click = (s: string) => {
    q(s)!.click();
    fixture.detectChanges();
  };

  it('shows the services in a data table with a plain-link name, framework codes as tags and status indicators', () => {
    setup([READY, PREPARING]);
    expect(el().querySelectorAll('app-data-table tbody tr').length).toBe(2);
    expect(q('tbody a[href="/services/s1"]')!.textContent).toContain('Soporte');
    expect(q('tbody app-tag')!.textContent).toContain('Catalog SOC 2'); // the name comes from the frameworks catalog
    expect(el().querySelectorAll('tbody app-tag')[1].textContent).toContain('iso27001'); // not in the catalog: falls back to the code
    expect(q('tbody app-status-indicator[data-tone="ok"]')!.textContent).toContain('SERVICES.LIST.CATALOG_READY');
    expect(el().querySelectorAll('tbody app-status-indicator[data-tone="warn"]').length).toBe(1); // the one without connections
    expect(el().querySelector('.rounded-full.px-2\\.5, .bg-brand-50')).toBeNull(); // no filled chips
  });

  it('has a single primary action in the header', () => {
    setup([READY]);
    const primaries = el().querySelectorAll('.mk-btn');
    expect(primaries.length).toBe(1);
    expect(primaries[0].getAttribute('href')).toBe('/services/new');
  });

  it('has no always-visible disabled delete button: the selection bar appears with a selection', () => {
    setup([READY, PREPARING]);
    expect(q('[data-test-selection-bar]')).toBeNull();
    el().querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[0].click();
    fixture.detectChanges();
    expect(q('[data-test-selection-bar]')!.textContent).toContain('SERVICES.LIST.SELECTED');
    click('[data-test-delete-selected]');
    expect(q('[data-test-confirm]')).not.toBeNull();
    click('[data-test-confirm-yes]');
    expect(api.remove).toHaveBeenCalledOnceWith('s1');
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
  });

  it('deletes one service from its row action, asking first', () => {
    setup([READY, PREPARING]);
    el().querySelectorAll<HTMLElement>('[data-test-delete-row]')[1].click();
    fixture.detectChanges();
    expect(api.remove).not.toHaveBeenCalled();
    expect(q('[data-test-confirm]')).not.toBeNull();
    click('[data-test-confirm-yes]');
    expect(api.remove).toHaveBeenCalledOnceWith('s2');
  });

  it('filters by name and says when nothing matches', () => {
    setup([READY, PREPARING]);
    const search = q('input[type="search"]') as HTMLInputElement;
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().textContent).toContain('SERVICES.LIST.NO_MATCH');
  });

  it('with no services, shows an empty state with the one call to action and no header button', () => {
    setup([]);
    expect(q('app-empty-state')).not.toBeNull();
    expect(el().querySelectorAll('.mk-btn').length).toBe(1);
    expect(q('app-empty-state a[href="/services/new"]')).not.toBeNull();
    expect(q('app-data-table')).toBeNull();
  });
});
