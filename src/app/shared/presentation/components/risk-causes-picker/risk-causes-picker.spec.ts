import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Cause, RiskDetail } from '@shared/domain/models/risk.models';
import { RiskService } from '@shared/domain/services/risk.service';
import { provideCatalogStub } from '@shared/testing/catalog-options';
import { RiskCausesPicker } from './risk-causes-picker';

const cause = (id: string, code: string, name: string, patch: Partial<Cause> = {}): Cause =>
  ({ id, service_id: 's1', code, name, description: `Qué es ${name}`, failure_category: 'processes', origin: 'catalog', is_active: true, risks: [], controls: [], ...patch }) as Cause;

// D93 · Las causas de un riesgo recién agregado: se marcan entre las del servicio o se crea una nueva, y cada marca se guarda al instante.
describe('RiskCausesPicker (D93)', () => {
  let api: jasmine.SpyObj<RiskService>;
  let fixture: ComponentFixture<RiskCausesPicker>;
  const el = () => fixture.nativeElement as HTMLElement;
  const box = (id: string) => el().querySelector<HTMLInputElement>(`[data-cause="${id}"]`)!;

  beforeEach(() => {
    api = jasmine.createSpyObj<RiskService>('RiskService', ['listAllCauses', 'getRisk', 'linkCause', 'unlinkCause', 'getCause']);
    api.listAllCauses.and.returnValue(of([cause('c2', 'F002', 'Sin respaldo'), cause('c1', 'F001', 'Contraseñas débiles'), cause('c3', 'F003', 'Baja', { is_active: false })]));
    api.getRisk.and.returnValue(of({ id: 'r1', causes: [{ id: 'c1' }] } as unknown as RiskDetail));
    api.linkCause.and.returnValue(of(undefined));
    api.unlinkCause.and.returnValue(of(undefined));
    TestBed.configureTestingModule({ imports: [RiskCausesPicker], providers: [provideTranslateService(), provideCatalogStub(), { provide: RiskService, useValue: api }] });
    fixture = TestBed.createComponent(RiskCausesPicker);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.componentRef.setInput('riskId', 'r1');
    fixture.componentRef.setInput('riskName', 'Pérdida de un portátil');
    fixture.detectChanges();
  });

  it('lists the active causes of the service in code order, with the ones already linked checked', () => {
    expect(Array.from(el().querySelectorAll('[data-cause]')).map((b) => b.getAttribute('data-cause'))).toEqual(['c1', 'c2']); // la dada de baja no sale
    expect(box('c1').checked).toBeTrue();
    expect(box('c2').checked).toBeFalse();
  });

  it('links and unlinks right when a box is checked, without a save button', () => {
    box('c2').click();
    fixture.detectChanges();
    expect(api.linkCause).toHaveBeenCalledOnceWith('r1', 'c2');
    expect(box('c2').checked).toBeTrue();
    box('c1').click();
    fixture.detectChanges();
    expect(api.unlinkCause).toHaveBeenCalledOnceWith('r1', 'c1');
    expect(box('c1').checked).toBeFalse();
  });

  it('filters by what is typed', () => {
    const search = el().querySelector<HTMLInputElement>('[data-causes-search] input')!;
    search.value = 'respaldo';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(el().querySelectorAll('[data-cause]')).map((b) => b.getAttribute('data-cause'))).toEqual(['c2']);
  });

  it('adds a cause that was just created to the list and links it to the risk', () => {
    api.getCause.and.returnValue(of(cause('c9', 'F009', 'Nueva causa', { origin: 'own' })));
    fixture.componentInstance.onCreated('c9');
    fixture.detectChanges();
    expect(api.linkCause).toHaveBeenCalledWith('r1', 'c9');
    expect(box('c9').checked).toBeTrue();
  });

  it('lets the person continue without checking anything', () => {
    let done = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    el().querySelector<HTMLButtonElement>('[data-causes-done]')!.click();
    expect(done).toBe(1);
  });
});