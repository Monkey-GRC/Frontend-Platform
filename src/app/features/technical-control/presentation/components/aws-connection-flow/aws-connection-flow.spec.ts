import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Asset, Platform, ValidationResult } from '@shared/domain/models/technical-control.models';
import { connectionOptionsStub } from '@shared/testing/connection-options';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { AwsConnectionFlow } from './aws-connection-flow';

const PLATFORM: Platform = { code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', availability: 'available', connection_methods: ['readonly_role', 'access_keys'] };
const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'a1', code: 'AST-0001', name: 'AWS producción', connection_category: 'ac_01', type: 'cloud_service', platform: 'aws', operational_status: 'not_monitored', technical_coverage: '0/18',
  external_account_id: '123456789012', services: [], provisioning: { connection_status: 'pending', connection_method: 'readonly_role', is_active: false, schedule_frequency: null },
  connection_setup: { method: 'readonly_role', external_id: 'mk-abc', monkey_principal_arn: 'arn:aws:iam::210987654321:root', role_arn: null, steps: ['Descarga la plantilla.', 'Crea la pila.'] },
  ...over,
});
const VALID: ValidationResult = { connection_status: 'validated', last_validated_at: null, technical_coverage: '0/18', checks_available: 0, mode: 'live' };
const apiError = (status: number, code: string, fields: { field: string; message: string }[] = []) => new HttpErrorResponse({ status, error: { error: { code, message: 'x', fields } } });

describe('AwsConnectionFlow', () => {
  let fixture: ComponentFixture<AwsConnectionFlow>;
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
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  function create(resume: Asset | null = null): void {
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options', 'connectionOptions']);
    catalogs.connectionOptions.and.callFake(connectionOptionsStub);
    catalogs.options.and.returnValue(of([{ value: 'us-east-1', label: 'Este de EE. UU. (Virginia)' }]));
    TestBed.configureTestingModule({
      imports: [AwsConnectionFlow],
      providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }, { provide: CatalogService, useValue: catalogs }],
    });
    fixture = TestBed.createComponent(AwsConnectionFlow);
    fixture.componentRef.setInput('platform', PLATFORM);
    fixture.componentRef.setInput('service', { id: 's1', name: 'Pagos' });
    fixture.componentRef.setInput('criticalities', [{ value: 'medium', label: 'Media' }]);
    fixture.componentRef.setInput('resume', resume);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['createAsset', 'setRoleArn', 'validate', 'getAsset', 'downloadRoleTemplate']);
    api.createAsset.and.returnValue(of(asset()));
    api.getAsset.and.returnValue(of(asset({ provisioning: { connection_status: 'validated', is_active: false, schedule_frequency: null } })));
  });

  async function toAccess(): Promise<void> {
    next();
    type('#aws-account', '123456789012');
    type('#aws-name', 'AWS producción');
    q<HTMLElement>('app-option-chips button')!.click();
    fixture.detectChanges();
    next();
    await settle();
  }

  it('starts at «how to connect» with the role recommended and the same five-step stepper as every platform', () => {
    create();
    expect(stepIndex()).toBe('0');
    expect(el().querySelectorAll('[data-wizard-steps] li').length).toBe(5);
    expect(q('[data-option="readonly_role"] button')!.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-option="readonly_role"]')!.textContent).toContain('TAG_RECOMMENDED');
    expect(q('[data-option="access_keys"]')!.textContent).toContain('TAG_LESS_SECURE');
    expect(q('[data-wizard-back]')).toBeNull();
  });

  it('does not create anything with an incomplete account and keeps the hints', () => {
    create();
    next();
    type('#aws-account', '123');
    next();
    expect(api.createAsset).not.toHaveBeenCalled();
    expect(q('#aws-account-error')).not.toBeNull();
    expect(q('[data-regions-error]')).not.toBeNull();
  });

  it('creates the asset with the role at the end of «data», without credentials, and shows the backend steps and the values to copy', async () => {
    create();
    await toAccess();
    const body = api.createAsset.calls.mostRecent().args[0];
    expect(body).toEqual(jasmine.objectContaining({ platform: 'aws', connection_category: 'ac_01', connection_method: 'readonly_role', external_account_id: '123456789012', regions: ['us-east-1'], service_ids: ['s1'] }));
    expect(body.credentials).toBeUndefined();
    expect(stepIndex()).toBe('2');
    expect(el().querySelectorAll('[data-steps] li').length).toBe(2);
    expect(el().querySelectorAll('app-copy-value').length).toBe(2);
    expect(q('[data-wizard-back]')).toBeNull();
  });

  it('checks the role: saves the ARN, validates and ends on the result', async () => {
    api.setRoleArn.and.returnValue(of(asset()));
    api.validate.and.returnValue(of(VALID));
    create();
    await toAccess();
    next();
    expect(stepIndex()).toBe('3');
    type('#aws-role-arn', 'arn:aws:iam::123456789012:role/MonkeyReadOnly');
    next();
    await settle();
    expect(api.setRoleArn).toHaveBeenCalledWith('a1', 'arn:aws:iam::123456789012:role/MonkeyReadOnly');
    expect(api.validate).toHaveBeenCalledWith('a1');
    expect(stepIndex()).toBe('4');
    expect(q('[data-result-project]')!.textContent).toContain('123456789012');
  });

  it('asks for the role before checking, and offers to check again when the connection fails', async () => {
    api.setRoleArn.and.returnValue(of(asset()));
    api.validate.and.returnValue(throwError(() => apiError(422, 'CONNECTION_FAILED', [{ field: 'role_arn', message: 'No pudimos asumir ese rol.' }])));
    create();
    await toAccess();
    next();
    next();
    expect(api.setRoleArn).not.toHaveBeenCalled();
    expect(q('#aws-role-arn-error')).not.toBeNull();
    type('#aws-role-arn', 'arn:aws:iam::123456789012:role/MonkeyReadOnly');
    next();
    await settle();
    expect(stepIndex()).toBe('3');
    expect(q('[data-message]')!.textContent).toContain('No pudimos asumir ese rol.');
    expect(q('[data-wizard-next]')!.textContent).toContain('CHECK_AGAIN');
  });

  it('with access keys, sends them only once at the end of «give access», never again, and then only checks', async () => {
    api.createAsset.and.returnValue(of(asset({ provisioning: { connection_status: 'pending', connection_method: 'access_keys', is_active: false, schedule_frequency: null }, connection_setup: { method: 'access_keys', steps: [] } })));
    api.validate.and.returnValue(of(VALID));
    create();
    q<HTMLElement>('[data-option="access_keys"] button')!.click();
    fixture.detectChanges();
    next();
    type('#aws-account', '123456789012');
    type('#aws-name', 'AWS producción');
    q<HTMLElement>('app-option-chips button')!.click();
    fixture.detectChanges();
    next();
    expect(api.createAsset).not.toHaveBeenCalled();
    expect(stepIndex()).toBe('2');
    next();
    expect(api.createAsset).not.toHaveBeenCalled();
    type('#aws-key-id', 'AKIAEXAMPLE');
    type('#aws-key-secret', 'secreto');
    next();
    await settle();
    expect(api.createAsset.calls.mostRecent().args[0].credentials).toEqual({ access_key_id: 'AKIAEXAMPLE', secret_access_key: 'secreto' });
    expect(stepIndex()).toBe('3');
    expect(q('#aws-role-arn')).toBeNull();
    expect(q('[data-wizard-back]')).toBeNull();
    next();
    await settle();
    expect(api.setRoleArn).not.toHaveBeenCalled();
    expect(api.validate).toHaveBeenCalledWith('a1');
    expect(stepIndex()).toBe('4');
  });

  it('resumes a pending role connection at «give access» without creating anything again', () => {
    create(asset());
    expect(stepIndex()).toBe('2');
    expect(q('[data-wizard-back]')).toBeNull();
    expect(api.createAsset).not.toHaveBeenCalled();
  });

  it('resumes at «check» when the role was already delivered, with the ARN filled in and a way back', () => {
    create(asset({ connection_setup: { method: 'readonly_role', monkey_principal_arn: 'x', role_arn: 'arn:aws:iam::123456789012:role/R', steps: [] } }));
    expect(stepIndex()).toBe('3');
    expect(q<HTMLInputElement>('#aws-role-arn')!.value).toBe('arn:aws:iam::123456789012:role/R');
    expect(q('[data-wizard-back]')).not.toBeNull();
  });

  it('computes what leaving loses: nothing at the start, the typed data before the asset exists, a saved connection after', async () => {
    create();
    expect(fixture.componentInstance.leaveMode()).toBe('none');
    next();
    expect(fixture.componentInstance.leaveMode()).toBe('discard');
    type('#aws-account', '123456789012');
    type('#aws-name', 'AWS producción');
    q<HTMLElement>('app-option-chips button')!.click();
    fixture.detectChanges();
    next();
    await settle();
    expect(fixture.componentInstance.leaveMode()).toBe('saved');
  });
});
