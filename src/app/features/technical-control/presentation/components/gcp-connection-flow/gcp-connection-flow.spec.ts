import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { connectionOptionsStub } from '@shared/testing/connection-options';
import { Asset, Platform, ValidationResult } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { GcpConnectionFlow } from './gcp-connection-flow';

const PLATFORM: Platform = { code: 'gcp', name: 'Google Cloud (GCP)', logo_key: 'gcp', availability: 'available', connection_methods: ['identity_federation'] };
const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'a1', code: 'AST-0001', name: 'GCP producción', connection_category: 'ac_01', type: 'cloud_service', platform: 'gcp', operational_status: 'not_monitored', technical_coverage: '0/18',
  external_account_id: 'acme-prod-421905', services: [], provisioning: { connection_status: 'pending', is_active: false, schedule_frequency: null },
  connection_setup: { method: 'identity_federation', external_id: 'mk-abc', project_id: 'acme-prod-421905', project_number: null, setup_command: 'bash <(echo script)', steps: ['Abre Cloud Shell.', 'Pega el comando.', 'Copia el número.'] },
  ...over,
});
const VALID: ValidationResult = { connection_status: 'validated', last_validated_at: null, technical_coverage: '0/18', checks_available: 0, mode: 'live' };
const apiError = (status: number, code: string, fields: { field: string; message: string }[] = []) => new HttpErrorResponse({ status, error: { error: { code, message: 'x', fields } } });

describe('GcpConnectionFlow', () => {
  let fixture: ComponentFixture<GcpConnectionFlow>;
  let catalogs: jasmine.SpyObj<CatalogService>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T | null;
  const next = () => {
    q<HTMLButtonElement>('[data-wizard-next]')!.click();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const stepIndex = () => q('[data-wizard-steps] li[aria-current="step"]')!.getAttribute('data-step');

  beforeEach(() => {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['createAsset', 'setProjectNumber', 'validate', 'getAsset']);
    api.createAsset.and.returnValue(of(asset()));
    api.getAsset.and.returnValue(of(asset({ provisioning: { connection_status: 'validated', is_active: false, schedule_frequency: null } })));
    catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['connectionOptions']);
    catalogs.connectionOptions.and.callFake(connectionOptionsStub);
    TestBed.configureTestingModule({ imports: [GcpConnectionFlow], providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }, { provide: CatalogService, useValue: catalogs }] });
    fixture = TestBed.createComponent(GcpConnectionFlow);
    fixture.componentRef.setInput('platform', PLATFORM);
    fixture.componentRef.setInput('service', { id: 's1', name: 'Pagos' });
    fixture.componentRef.setInput('criticalities', [{ value: 'medium', label: 'Media' }]);
    fixture.detectChanges();
  });

  it('starts at «how to connect» with project and Cloud Shell preselected and a horizontal five-step stepper', () => {
    expect(stepIndex()).toBe('0');
    expect(el().querySelectorAll('[data-wizard-steps] li').length).toBe(5);
    expect(q('[data-option="project"] button')!.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-option="cloud_shell"] button')!.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-option="terraform"] button')!.getAttribute('aria-disabled')).toBe('true');
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.disabled).toBe(false);
    expect(q('[data-wizard-back]')).toBeNull();
  });

  it('does not let the client continue when the catalog failed, and recovers with «Reintentar»', () => {
    TestBed.resetTestingModule();
    catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['connectionOptions']);
    catalogs.connectionOptions.and.returnValue(throwError(() => new Error('down')));
    TestBed.configureTestingModule({ imports: [GcpConnectionFlow], providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }, { provide: CatalogService, useValue: catalogs }] });
    fixture = TestBed.createComponent(GcpConnectionFlow);
    fixture.componentRef.setInput('platform', PLATFORM);
    fixture.componentRef.setInput('service', { id: 's1', name: 'Pagos' });
    fixture.detectChanges();
    expect(q('[data-option-card]')).toBeNull();
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.disabled).toBe(true);
    catalogs.connectionOptions.and.callFake(connectionOptionsStub);
    q<HTMLButtonElement>('[data-options-retry]')!.click();
    fixture.detectChanges();
    expect(q('[data-option="project"] button')!.getAttribute('aria-checked')).toBe('true');
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.disabled).toBe(false);
  });

  it('asks for the project data, does not create anything with a bad ID, and goes back to the first step', () => {
    next();
    expect(stepIndex()).toBe('1');
    type('#gcp-project-id', 'Mal ID');
    type('#gcp-name', 'GCP producción');
    next();
    expect(api.createAsset).not.toHaveBeenCalled();
    expect(q('#gcp-project-id-error')).not.toBeNull();
    q<HTMLButtonElement>('[data-wizard-back]')!.click();
    fixture.detectChanges();
    expect(stepIndex()).toBe('0');
  });

  async function toAccess(): Promise<void> {
    next();
    type('#gcp-project-id', 'acme-prod-421905');
    type('#gcp-name', 'GCP producción');
    next();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('creates the connection with the federation channel, no credentials and no regions, and shows the command with the backend steps', async () => {
    await toAccess();
    const body = api.createAsset.calls.mostRecent().args[0];
    expect(body).toEqual(jasmine.objectContaining({ platform: 'gcp', connection_category: 'ac_01', connection_method: 'identity_federation', external_account_id: 'acme-prod-421905', service_ids: ['s1'] }));
    expect(body.credentials).toBeUndefined();
    expect(body.regions).toBeUndefined();
    expect(stepIndex()).toBe('2');
    expect(q('[data-command]')!.textContent).toContain('bash <(echo script)');
    expect(el().querySelectorAll('[data-steps] li').length).toBe(3);
    expect(q('[data-wizard-back]')).toBeNull();
  });

  it('shows the server error of the project ID on its own field and stays on the step', async () => {
    api.createAsset.and.returnValue(throwError(() => apiError(422, 'VALIDATION_FAILED', [{ field: 'external_account_id', message: 'No es un ID válido' }])));
    await toAccess();
    expect(stepIndex()).toBe('1');
    expect(q('[data-server-error]')!.textContent).toContain('No es un ID válido');
  });

  it('cannot continue without the command when the server has no identity configured', async () => {
    api.createAsset.and.returnValue(of(asset({ connection_setup: { method: 'identity_federation', project_id: 'acme-prod-421905', setup_command: null, steps: [] } })));
    await toAccess();
    expect(q('[data-no-command]')).not.toBeNull();
    expect(q<HTMLButtonElement>('[data-wizard-next]')!.disabled).toBe(true);
  });

  async function toCheck(): Promise<void> {
    await toAccess();
    next();
  }

  it('checks the connection with the project number and ends on the result, which hides nothing secret because there is nothing secret', async () => {
    api.setProjectNumber.and.returnValue(of(asset()));
    api.validate.and.returnValue(of(VALID));
    await toCheck();
    expect(stepIndex()).toBe('3');
    type('#gcp-project-number', '407295138461');
    next();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.setProjectNumber).toHaveBeenCalledWith('a1', '407295138461');
    expect(api.validate).toHaveBeenCalledWith('a1');
    expect(stepIndex()).toBe('4');
    expect(q('[data-result-project]')!.textContent).toContain('acme-prod-421905');
    expect(q('[data-wizard-back]')).toBeNull();
  });

  it('opens the connection from the result', async () => {
    api.setProjectNumber.and.returnValue(of(asset()));
    api.validate.and.returnValue(of(VALID));
    const opened: Asset[] = [];
    fixture.componentInstance.openConnection.subscribe((a) => opened.push(a));
    await toCheck();
    type('#gcp-project-number', '407295138461');
    next();
    await fixture.whenStable();
    fixture.detectChanges();
    next();
    expect(opened.map((a) => a.id)).toEqual(['a1']);
  });

  it('does not call the server with a malformed project number', async () => {
    await toCheck();
    type('#gcp-project-number', '123');
    next();
    expect(api.setProjectNumber).not.toHaveBeenCalled();
    expect(q('#gcp-project-number-error')).not.toBeNull();
  });

  it('stays on the check step and offers to check again when the connection fails', async () => {
    api.setProjectNumber.and.returnValue(of(asset()));
    api.validate.and.returnValue(throwError(() => apiError(422, 'CONNECTION_FAILED', [{ field: 'project_number', message: 'No pudimos acceder a ese proyecto.' }])));
    await toCheck();
    type('#gcp-project-number', '407295138461');
    next();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(stepIndex()).toBe('3');
    expect(q('[data-message]')!.textContent).toContain('No pudimos acceder a ese proyecto.');
    expect(q('[data-wizard-next]')!.textContent).toContain('CHECK_AGAIN');
    expect(q<HTMLButtonElement>('[data-wizard-back]')).not.toBeNull();
  });

  it('does not save the number again when it is already the saved one', async () => {
    api.createAsset.and.returnValue(of(asset({ connection_setup: { method: 'identity_federation', project_id: 'acme-prod-421905', project_number: '407295138461', setup_command: 'x', steps: [] } })));
    api.validate.and.returnValue(of(VALID));
    await toCheck();
    type('#gcp-project-number', '407295138461');
    next();
    await fixture.whenStable();
    expect(api.setProjectNumber).not.toHaveBeenCalled();
    expect(api.validate).toHaveBeenCalled();
  });

  it('resumes a pending connection: without project number at «give access», with it at «check» and the number filled in', () => {
    const resumeWith = (over: Partial<Asset>) => {
      fixture = TestBed.createComponent(GcpConnectionFlow);
      fixture.componentRef.setInput('platform', PLATFORM);
      fixture.componentRef.setInput('service', { id: 's1', name: 'Pagos' });
      fixture.componentRef.setInput('resume', asset(over));
      fixture.detectChanges();
    };
    resumeWith({});
    expect(stepIndex()).toBe('2');
    expect(q('[data-command]')).not.toBeNull();
    resumeWith({ connection_setup: { method: 'identity_federation', project_id: 'acme-prod-421905', project_number: '407295138461', setup_command: 'x', steps: [] } });
    expect(stepIndex()).toBe('3');
    expect(q<HTMLInputElement>('#gcp-project-number')!.value).toBe('407295138461');
    expect(api.createAsset).not.toHaveBeenCalled();
  });

  it('computes what leaving loses: nothing at the start, the data before the asset exists, a saved connection after', async () => {
    expect(fixture.componentInstance.leaveMode()).toBe('none');
    next();
    expect(fixture.componentInstance.leaveMode()).toBe('discard');
    await toAccess2();
    expect(fixture.componentInstance.leaveMode()).toBe('saved');
  });

  async function toAccess2(): Promise<void> {
    type('#gcp-project-id', 'acme-prod-421905');
    type('#gcp-name', 'GCP producción');
    next();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
