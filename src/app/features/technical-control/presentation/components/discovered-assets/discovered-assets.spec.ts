import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset, DiscoveredAsset, DiscoveredAssetsPage } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { DiscoveredAssets } from './discovered-assets';

const asset = (id: string, name: string, inService: boolean, state = 'running'): DiscoveredAsset => ({
  id, code: id.toUpperCase(), kind: 'server', type: 'ec2', name, region: 'us-east-1', platform: 'aws', ip_address: '10.0.0.1', location: 'us-east-1a', criticality: 'high', tags: ['env:prod'],
  attributes: { instance_id: `i-${id}`, os: 'Ubuntu', state }, in_service: inService,
});

const page = (items: DiscoveredAsset[]): DiscoveredAssetsPage => ({
  discovered_at: '2026-11-01T10:00:00Z', regions: ['us-east-1'], incomplete_services: [], summary: [{ kind: 'server', count: items.length }], included_count: 1,
  items, page: 1, page_size: 100, total: items.length, total_pages: 1,
});

describe('DiscoveredAssets', () => {
  let fixture: ComponentFixture<DiscoveredAssets>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function setup(items: DiscoveredAsset[], inputs: { canEvaluate?: boolean; evaluating?: boolean } = {}): DiscoveredAssets {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['listDiscovered', 'setServiceAssets']);
    api.listDiscovered.and.returnValue(of(page(items)));
    api.setServiceAssets.and.returnValue(of({ included: 2, added: 1, removed: 0 }));
    TestBed.configureTestingModule({
      imports: [DiscoveredAssets],
      providers: [
        provideTranslateService(),
        { provide: TechnicalControlService, useValue: api },
        { provide: CatalogService, useValue: { options: () => of([{ value: 'server', label: 'Servidores' }]) } },
      ],
    });
    fixture = TestBed.createComponent(DiscoveredAssets);
    fixture.componentRef.setInput('asset', { id: 'c1', provisioning: { last_validated_at: null } } as unknown as Asset);
    fixture.componentRef.setInput('serviceId', 's1');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('lists the assets in the one table, with a checkbox per row that starts checked for the ones already in the service', () => {
    setup([asset('a1', 'web-01', true), asset('a2', 'web-02', false)]);
    expect(el().querySelectorAll('app-data-table').length).toBe(1);
    expect(el().querySelectorAll('tbody tr:not([data-group-header])').length).toBe(2);
    const boxes = Array.from(el().querySelectorAll<HTMLInputElement>('[data-select-row]'));
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    expect(el().querySelector('[data-select-all]')).not.toBeNull();
  });

  it('separates «in this service» from «outside the service» with a section header, only when some asset is already in the service', () => {
    setup([asset('a1', 'web-01', true), asset('a2', 'web-02', false)]);
    expect(Array.from(el().querySelectorAll('[data-group-header]')).map((h) => h.getAttribute('data-group'))).toEqual(['in', 'out']);
    TestBed.resetTestingModule();
    setup([asset('a1', 'web-01', false), asset('a2', 'web-02', false)]);
    expect(el().querySelectorAll('[data-group-header]').length).toBe(0);
  });

  it('marking a row changes what would be saved, and saving sends exactly the marked ones', () => {
    const view = setup([asset('a1', 'web-01', true), asset('a2', 'web-02', false)]);
    expect(view.dirty()).toBeFalse();
    el().querySelectorAll<HTMLInputElement>('[data-select-row]')[1].click();
    fixture.detectChanges();
    expect(view.dirty()).toBeTrue();
    view.save();
    expect(api.setServiceAssets).toHaveBeenCalledOnceWith('s1', 'c1', ['a1', 'a2']);
  });

  it('says the state with a dot and a word, and the inclusion as a status, not as pills or icons', () => {
    setup([asset('a1', 'web-01', true, 'stopped')]);
    const tones = Array.from(el().querySelectorAll('tbody app-status-indicator')).map((s) => s.getAttribute('data-tone'));
    expect(tones).toEqual(['neutral', 'ok']);
    expect(el().innerHTML).not.toContain('rounded-full px-');
    expect(el().querySelector('app-os-icon')).toBeNull();
  });

  it('opens the detail of an asset in the side drawer from its name', () => {
    setup([asset('a1', 'web-01', true)]);
    el().querySelector<HTMLButtonElement>('tbody button')!.click();
    fixture.detectChanges();
    expect(el().querySelector('[role="dialog"]')).not.toBeNull();
  });

  describe('evaluate now, next to save', () => {
    const button = () => el().querySelector('[data-evaluate-now]') as HTMLButtonElement | null;
    const two = () => [asset('a1', 'web-01', true), asset('a2', 'web-02', false)];

    it('is not offered until the account is connected', () => {
      setup(two(), { canEvaluate: false });
      expect(button()).toBeNull();
    });

    it('is offered and asks to evaluate when pressed', () => {
      const view = setup(two(), { canEvaluate: true });
      let asked = 0;
      view.evaluate.subscribe(() => asked++);
      expect(button()!.disabled).toBeFalse();
      button()!.click();
      expect(asked).toBe(1);
    });

    it('waits while an evaluation is already queued or running', () => {
      const view = setup(two(), { canEvaluate: true, evaluating: true });
      let asked = 0;
      view.evaluate.subscribe(() => asked++);
      expect(button()!.getAttribute('aria-busy')).toBe('true');
      expect(button()!.getAttribute('aria-disabled')).toBe('true');
      button()!.click();
      expect(asked).toBe(0);
    });

    it('waits while the selection has unsaved changes, so it never evaluates with old choices', () => {
      const view = setup(two(), { canEvaluate: true });
      view.toggle('a2');
      fixture.detectChanges();
      expect(button()!.disabled).toBeTrue();
      expect(button()!.getAttribute('title')).toContain('EVALUATE_SAVE_FIRST');
    });
  });
});
