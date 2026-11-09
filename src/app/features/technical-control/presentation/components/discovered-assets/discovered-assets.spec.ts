import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset, DiscoveredAssetsPage } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { DiscoveredAssets } from './discovered-assets';

const asset = { id: 'a1', code: 'AWS-001', name: 'Cuenta AWS', connection_category: 'ac_01', provisioning: { connection_status: 'scheduled', is_active: true, schedule_frequency: 'daily' } } as unknown as Asset;
const item = (i: number, inService: boolean) => ({ id: `d${i}`, code: `RES-${i}`, kind: 'server', type: 'vm', name: `srv-${i}`, region: 'us-east-1', platform: 'aws', ip_address: `10.0.0.${i}`, location: null, criticality: 'medium', tags: [], attributes: {}, in_service: inService });
const page = { discovered_at: '2026-11-06T10:00:00Z', regions: ['us-east-1'], incomplete_services: [], summary: [{ kind: 'server', count: 2 }], included_count: 1, items: [item(1, true), item(2, false)], page: 1, page_size: 100, total: 2, total_pages: 1 } as unknown as DiscoveredAssetsPage;

// «Evaluar ahora» vive abajo, junto a «Guardar selección»: se evalúa lo que se acaba de elegir.
describe('DiscoveredAssets · evaluar ahora', () => {
  let fixture: ComponentFixture<DiscoveredAssets>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('[data-evaluate-now]') as HTMLButtonElement | null;

  function open(inputs: { canEvaluate?: boolean; evaluating?: boolean } = {}) {
    TestBed.configureTestingModule({
      imports: [DiscoveredAssets],
      providers: [
        provideTranslateService(),
        { provide: TechnicalControlService, useValue: { listDiscovered: () => of(page), setServiceAssets: () => of(undefined) } },
        { provide: CatalogService, useValue: { options: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(DiscoveredAssets);
    fixture.componentRef.setInput('asset', asset);
    fixture.componentRef.setInput('serviceId', 's1');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('is not offered until the account is connected', () => {
    open({ canEvaluate: false });
    expect(button()).toBeNull();
  });

  it('is offered next to save and asks to evaluate when pressed', () => {
    open({ canEvaluate: true });
    let asked = 0;
    fixture.componentInstance.evaluate.subscribe(() => asked++);
    expect(button()).not.toBeNull();
    expect(button()!.disabled).toBeFalse();
    button()!.click();
    expect(asked).toBe(1);
  });

  it('waits while an evaluation is already queued or running', () => {
    open({ canEvaluate: true, evaluating: true });
    expect(button()!.disabled).toBeTrue();
  });

  it('waits while the selection has unsaved changes, so it never evaluates with old choices', () => {
    open({ canEvaluate: true });
    fixture.componentInstance.toggle('d2');
    fixture.detectChanges();
    expect(button()!.disabled).toBeTrue();
    expect(button()!.getAttribute('title')).toContain('EVALUATE_SAVE_FIRST');
  });
});
