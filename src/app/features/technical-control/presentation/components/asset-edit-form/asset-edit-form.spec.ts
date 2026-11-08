import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { AssetEditForm } from './asset-edit-form';

const asset = {
  id: 'a1', name: 'Cuenta AWS', criticality: 'high', connection_category: 'ac_01', platform: 'aws', external_account_id: '123456789012',
  provisioning: { connection_method: 'readonly_role', connection_status: 'active', regions: ['us-east-1'] },
} as unknown as Asset;

// «Evaluar ahora» vive junto a «Guardar cambios», donde se configura lo que se evalúa.
describe('AssetEditForm · evaluar ahora', () => {
  let fixture: ComponentFixture<AssetEditForm>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('[data-evaluate-now]') as HTMLButtonElement | null;

  function open(inputs: { canEvaluate?: boolean; evaluating?: boolean } = {}) {
    TestBed.configureTestingModule({
      imports: [AssetEditForm],
      providers: [
        provideTranslateService(),
        { provide: TechnicalControlService, useValue: {} },
        { provide: CatalogService, useValue: { list: () => NEVER, options: () => NEVER, regions: () => NEVER } },
      ],
    });
    fixture = TestBed.createComponent(AssetEditForm);
    fixture.componentRef.setInput('asset', asset);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('is not offered when the account cannot be evaluated yet', () => {
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

  it('waits while there are unsaved changes, so it never evaluates with old details', () => {
    open({ canEvaluate: true });
    fixture.componentInstance.name.set('Otro nombre');
    fixture.detectChanges();
    expect(button()!.disabled).toBeTrue();
    expect(button()!.getAttribute('title')).toContain('EVALUATE_SAVE_FIRST');
  });
});
