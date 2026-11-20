import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Cause, RiskDetail } from '@shared/domain/models/risk.models';
import { RiskService } from '@shared/domain/services/risk.service';
import { provideCatalogStub } from '@shared/testing/catalog-options';
import { RiskForm, RiskFormKind } from './risk-form';
import { isSelect, optionValues, pickOption } from '@shared/presentation/components/select/select.testing';

const RISK: RiskDetail = {
  id: 'r9', service_id: 's1', code: 'R050', name: 'Pérdida de un portátil', description: 'Se extravía.', trust_criterion: 'confidentiality', potential_impact: ['reputational'],
  origin: 'own', is_active: true, likelihood: null, impact: null, inherent_risk_value: null, inherent_risk_level: null, treatment: null, causes: [],
};
const CAUSE: Cause = { id: 'c9', service_id: 's1', code: 'F050', name: 'Sin copias', description: 'No hay.', failure_category: 'processes', origin: 'own', is_active: true, risks: [], controls: [] };

describe('RiskForm', () => {
  let api: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<RiskForm>;
  let saved: string[];

  function setup(kind: RiskFormKind, existing: RiskDetail | Cause | null = null): void {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['createRisk', 'updateRisk', 'createCause', 'updateCause']);
    TestBed.configureTestingModule({ imports: [RiskForm], providers: [provideTranslateService(), provideCatalogStub(), { provide: RiskService, useValue: api }] });
    fixture = TestBed.createComponent(RiskForm);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.componentRef.setInput('existing', existing);
    saved = [];
    fixture.componentInstance.saved.subscribe((id) => saved.push(id));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const type = async (field: string, value: string) => {
    if (isSelect(el(), `[data-field="${field}"]`)) pickOption(el(), `[data-field="${field}"]`, value, () => fixture.detectChanges());
    else {
      const input = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${field}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const save = () => {
    el().querySelector<HTMLButtonElement>('[data-save]')!.click();
    fixture.detectChanges();
  };

  it('asks for the required fields without calling the backend', () => {
    setup('risk');
    save();
    expect(api.createRisk).not.toHaveBeenCalled();
    for (const f of ['name', 'description', 'group']) expect(el().querySelector(`[data-error="${f}"]`)).not.toBeNull();
  });

  it('offers the criteria and the loss types that the backend serves', () => {
    setup('risk');
    const values = optionValues(el(), '[data-field="group"]', () => fixture.detectChanges());
    expect(values).toEqual(['confidentiality', 'integrity', 'security']);
    expect(el().querySelector('[data-impact="financial_loss"]')).not.toBeNull();
  });

  it('creates a risk of the service with its criterion and the impacts that were ticked', async () => {
    setup('risk');
    api.createRisk.and.returnValue(of({ ...RISK, id: 'new' }));
    await type('name', '  Un riesgo  ');
    await type('description', 'Descripción');
    await type('group', 'security');
    el().querySelector<HTMLInputElement>('[data-impact="reputational"]')!.click();
    save();
    expect(api.createRisk).toHaveBeenCalledOnceWith('s1', { name: 'Un riesgo', description: 'Descripción', trust_criterion: 'security', potential_impact: ['reputational'] });
    expect(saved).toEqual(['new']);
  });

  it('creates a cause with its failure category and no impact', async () => {
    setup('cause');
    api.createCause.and.returnValue(of({ ...CAUSE, id: 'nueva' }));
    expect(el().querySelector('[data-impact]')).toBeNull();
    await type('name', 'Causa');
    await type('description', 'D');
    await type('group', 'processes');
    save();
    expect(api.createCause).toHaveBeenCalledOnceWith('s1', { name: 'Causa', description: 'D', failure_category: 'processes' });
    expect(saved).toEqual(['nueva']);
  });

  it('starts an edit with the current values and only enables saving once something changed', async () => {
    setup('risk', RISK);
    expect(el().querySelector<HTMLInputElement>('[data-field="name"]')!.value).toBe('Pérdida de un portátil');
    expect(el().querySelector<HTMLButtonElement>('[data-save]')!.disabled).toBeTrue();
    api.updateRisk.and.returnValue(of(RISK));
    await type('name', 'Otro nombre');
    expect(el().querySelector<HTMLButtonElement>('[data-save]')!.disabled).toBeFalse();
    save();
    expect(api.updateRisk).toHaveBeenCalledOnceWith('r9', jasmine.objectContaining({ name: 'Otro nombre', trust_criterion: 'confidentiality' }));
  });

  it('edits a cause through its own endpoint', async () => {
    setup('cause', CAUSE);
    api.updateCause.and.returnValue(of(CAUSE));
    await type('description', 'Nueva');
    save();
    expect(api.updateCause).toHaveBeenCalledOnceWith('c9', { name: 'Sin copias', description: 'Nueva', failure_category: 'processes' });
  });

  it('shows the backend message in a notice when it refuses without a field', async () => {
    setup('cause');
    api.createCause.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe.' } })));
    await type('name', 'n');
    await type('description', 'd');
    await type('group', 'processes');
    save();
    expect(el().querySelector('[data-banner]')!.textContent).toContain('Ya existe.');
    expect(saved).toEqual([]);
  });

  it('shows each field error that the backend sends next to its field', async () => {
    setup('risk');
    api.createRisk.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'x', error: { fields: [{ field: 'name', code: 'too_long', message: 'Demasiado largo.' }] } } })));
    await type('name', 'n');
    await type('description', 'd');
    await type('group', 'security');
    save();
    expect(el().querySelector('[data-error="name"]')!.textContent).toContain('Demasiado largo.');
  });

  it('guards only what differs from the start (MD-485): typed and erased back is not a change', async () => {
    setup('risk');
    const form = fixture.componentInstance;
    expect(form.changed()).toBeFalse();
    await type('name', 'Fuga de datos');
    expect(form.changed()).toBeTrue();
    await type('name', '  ');
    expect(form.changed()).toBeFalse();
  });
});
