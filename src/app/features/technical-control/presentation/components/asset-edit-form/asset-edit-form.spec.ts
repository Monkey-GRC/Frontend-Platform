import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
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
    let asked = 0;
    fixture.componentInstance.evaluate.subscribe(() => asked++);
    expect(button()!.getAttribute('aria-busy')).toBe('true');
    expect(button()!.getAttribute('aria-disabled')).toBe('true');
    button()!.click();
    expect(asked).toBe(0);
  });

  it('waits while there are unsaved changes, so it never evaluates with old details', () => {
    open({ canEvaluate: true });
    fixture.componentInstance.name.set('Otro nombre');
    fixture.detectChanges();
    expect(button()!.disabled).toBeTrue();
    expect(button()!.getAttribute('title')).toContain('EVALUATE_SAVE_FIRST');
  });

  it('Cancel with changes asks before discarding them; without changes it cancels at once (MD-485)', () => {
    open();
    const form = fixture.componentInstance;
    let cancelled = 0;
    form.cancelled.subscribe(() => cancelled++);
    const cancel = () => {
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('COMMON.CANCEL'))!.click();
      fixture.detectChanges();
    };
    const confirm = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="alertdialog"]');
    cancel();
    expect(cancelled).toBe(1);
    form.name.set('Cuenta AWS de producción');
    fixture.detectChanges();
    cancel();
    expect(cancelled).toBe(1);
    expect(confirm()).not.toBeNull();
    confirm()!.querySelector<HTMLButtonElement>('[data-cancel]')!.click();
    fixture.detectChanges();
    expect(confirm()).toBeNull();
    expect(form.name()).toBe('Cuenta AWS de producción');
    cancel();
    confirm()!.querySelector<HTMLButtonElement>('[data-confirm]')!.click();
    fixture.detectChanges();
    expect(cancelled).toBe(2);
  });
});

// El formulario lo decide la plataforma/canal: una cuenta AWS pide 12 dígitos y regiones; un proyecto GCP, su ID y sin regiones (el backend da 422 si llegan).
describe('AssetEditForm · por plataforma', () => {
  const gcp = {
    id: 'g1', name: 'Proyecto GCP', criticality: 'high', connection_category: 'ac_01', platform: 'gcp', external_account_id: 'mi-proyecto-123',
    provisioning: { connection_method: 'identity_federation', connection_status: 'active' },
  } as unknown as Asset;

  function open(a: Asset): ComponentFixture<AssetEditForm> {
    TestBed.configureTestingModule({
      imports: [AssetEditForm],
      providers: [
        provideTranslateService(),
        { provide: TechnicalControlService, useValue: {} },
        { provide: CatalogService, useValue: { list: () => NEVER, options: () => NEVER, regions: () => NEVER } },
      ],
    });
    const f = TestBed.createComponent(AssetEditForm);
    f.componentRef.setInput('asset', a);
    f.detectChanges();
    return f;
  }

  it('AWS: asks for the 12-digit account and the regions', () => {
    const f = open(asset);
    const html = f.nativeElement as HTMLElement;
    expect(html.textContent).toContain('EDIT.ACCOUNT');
    expect(html.textContent).toContain('EDIT.REGIONS');
    f.componentInstance.setAccountId('abc12');
    expect(f.componentInstance.accountId()).toBe('12');
    expect(f.componentInstance.valid()).toBeFalse();
  });

  it('GCP: asks for the project ID, shows no regions and never sends them', () => {
    const f = open(gcp);
    const c = f.componentInstance;
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('EDIT.ACCOUNT_GCP');
    expect(text).not.toContain('EDIT.REGIONS');
    expect(c.valid()).toBeTrue();
    c.setAccountId('otro-proyecto-9');
    expect(c.valid()).toBeTrue();
    expect(c.patch()).toEqual({ external_account_id: 'otro-proyecto-9' });
    expect('regions' in c.patch()).toBeFalse();
    c.setAccountId('1x');
    expect(c.valid()).toBeFalse();
  });

});
