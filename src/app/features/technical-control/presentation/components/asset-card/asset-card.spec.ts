import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Asset } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { AssetCard } from './asset-card';

const asset = (platform: string, status = 'validated') =>
  ({
    id: 'a1', code: 'AST-0001', name: 'Nube', platform, connection_category: 'ac_01', external_account_id: 'x', regions: [], services: [], tags: [],
    connection_setup: { method: 'admin_consent', tenant_id: 'x', steps: [] },
    provisioning: { connection_method: 'admin_consent', connection_status: status, is_active: false, schedule_frequency: null, last_validated_at: null },
  }) as unknown as Asset;

describe('AssetCard · qué se muestra con la conexión comprobada', () => {
  let fixture: ComponentFixture<AssetCard>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function show(value: Asset, last: object | null = null) {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['lastExecution', 'evaluate', 'listDiscovered']);
    api.lastExecution.and.returnValue(of(last) as never);
    api.listDiscovered.and.returnValue(of({ items: [], summary: [], discovered_at: null, regions: [], incomplete_services: [], included_count: 0 }) as never);
    api.evaluate.and.returnValue(of({ id: 'e1', status: 'queued' }) as never);
    TestBed.configureTestingModule({
      imports: [AssetCard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideTranslateService(), { provide: TechnicalControlService, useValue: api }],
    });
    fixture = TestBed.createComponent(AssetCard);
    fixture.componentRef.setInput('asset', value);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.detectChanges();
  }

  for (const platform of ['microsoft_365', 'gcp']) {
    it(`${platform} no lista activos: ofrece «Evaluar ahora» a la vista, sin una lista que nunca se llenaría`, () => {
      show(asset(platform));
      expect(el().querySelector('app-discovered-assets')).toBeNull();
      expect(api.listDiscovered).not.toHaveBeenCalled();
      el().querySelector<HTMLButtonElement>('[data-account-review] [data-evaluate-now]')!.click();
      expect(api.evaluate).toHaveBeenCalledOnceWith('a1');
      fixture.destroy();
    });
  }

  it('la guía del correo se puede abrir después, solo en la conexión con el botón de Microsoft', () => {
    show(asset('microsoft_365'));
    expect(el().querySelector('[data-mail-later] [data-mail-guide]')).not.toBeNull();
    TestBed.resetTestingModule();
    const other = asset('gcp') as unknown as { connection_setup: { method: string } };
    other.connection_setup.method = 'identity_federation';
    show(other as unknown as Asset);
    expect(el().querySelector('[data-mail-later]')).toBeNull();
    fixture.destroy();
  });

  it('con el correo ya leído deja de pedirlo y lo dice; si no se leyó, ofrece la guía', () => {
    for (const [reviewed, guide] of [[true, false], [false, true]] as const) {
      show(asset('microsoft_365'), { id: 'e1', status: 'completed', mail_reviewed: reviewed, finished_at: null });
      expect(el().querySelector('[data-mail-later]') !== null).toBe(guide);
      expect(el().querySelector('[data-mail-included]') !== null).toBe(!guide);
      TestBed.resetTestingModule();
    }
    show(asset('gcp'));
    fixture.destroy();
  });

  it('AWS sigue mostrando los activos que encontró', () => {
    show(asset('aws'));
    expect(el().querySelector('app-discovered-assets')).not.toBeNull();
    expect(el().querySelector('[data-account-review]')).toBeNull();
  });

  it('sin la conexión comprobada no se puede evaluar', () => {
    show(asset('microsoft_365', 'pending'));
    expect(el().querySelector('[data-account-review]')).toBeNull();
  });
});
