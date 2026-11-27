import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { ExternalNavigation } from '@features/technical-control/domain/services/external-navigation.service';
import { CHECK_ATTEMPTS, CHECK_RETRY_MS, M365ConnectionFlow } from './m365-connection-flow';

const platform = { code: 'microsoft_365', name: 'Microsoft 365', availability: 'available', connection_methods: ['admin_consent'] } as unknown as Platform;
const asset = (tenant: string | null = null, status = 'pending') =>
  ({
    id: 'a1', name: 'M365', platform: 'microsoft_365', connection_category: 'ac_01', external_account_id: tenant, services: [{ id: 's1', name: 'S' }],
    connection_setup: { method: 'admin_consent', tenant_id: tenant, steps: ['uno', 'dos', 'tres'] },
    provisioning: { connection_method: 'admin_consent', connection_status: status, is_active: false },
  }) as unknown as Asset;
const failed = (field: string, message: string) => new HttpErrorResponse({ status: 422, error: { error: { code: 'CONNECTION_FAILED', fields: [{ field, message }] } } });

describe('M365ConnectionFlow', () => {
  let fixture: ComponentFixture<M365ConnectionFlow>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  let external: jasmine.SpyObj<ExternalNavigation>;
  const el = () => fixture.nativeElement as HTMLElement;
  const next = () => el().querySelector<HTMLButtonElement>('[data-wizard-next]')!;

  function show(options: { resume?: Asset | null; returnError?: string } = {}) {
    TestBed.configureTestingModule({
      imports: [M365ConnectionFlow],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: TechnicalControlService, useValue: api },
        { provide: ExternalNavigation, useValue: external },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(options.returnError ? { m365_error: options.returnError } : {}) } } },
      ],
    });
    fixture = TestBed.createComponent(M365ConnectionFlow);
    fixture.componentRef.setInput('platform', platform);
    fixture.componentRef.setInput('service', { id: 's1', name: 'Servicio' });
    fixture.componentRef.setInput('resume', options.resume ?? null);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['createAsset', 'startMicrosoftConsent', 'validate', 'getAsset']);
    external = jasmine.createSpyObj<ExternalNavigation>('ExternalNavigation', ['toMicrosoft']);
    external.toMicrosoft.and.returnValue(true);
    api.getAsset.and.returnValue(of(asset('t1', 'validated')));
  });

  it('asks only for a name, creates the connection without any identifier and then offers to sign in', () => {
    api.createAsset.and.returnValue(of(asset()));
    show();
    expect(el().querySelectorAll('input[type="text"]').length).toBe(1);
    next().click();
    expect(api.createAsset).not.toHaveBeenCalled();

    fixture.componentInstance.name.set('Microsoft de la empresa');
    next().click();
    fixture.detectChanges();
    const sent = api.createAsset.calls.mostRecent().args[0] as unknown as Record<string, unknown>;
    expect(sent['connection_method']).toBe('admin_consent');
    expect(sent['external_account_id']).toBeUndefined();
    expect(el().querySelectorAll('[data-steps] li').length).toBe(3);
    expect(next().textContent).toContain('M365.ACCESS.BUTTON');
  });

  it('sends the browser to Microsoft and keeps the button busy so it cannot be pressed twice', () => {
    api.startMicrosoftConsent.and.returnValue(of({ authorize_url: 'https://login.microsoftonline.com/organizations/x' }));
    show({ resume: asset() });
    next().click();
    fixture.detectChanges();
    expect(external.toMicrosoft).toHaveBeenCalledOnceWith('https://login.microsoftonline.com/organizations/x');
    expect(fixture.componentInstance.busy()).toBeTrue();
  });

  it('says the connection is not available yet when the server is not set up, and stops if the destination is not Microsoft', () => {
    api.startMicrosoftConsent.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { error: { code: 'CONNECTION_UNAVAILABLE' } } })));
    show({ resume: asset() });
    next().click();
    fixture.detectChanges();
    expect(el().querySelector('[data-error]')!.textContent).toContain('M365.ACCESS.UNAVAILABLE');

    api.startMicrosoftConsent.and.returnValue(of({ authorize_url: 'https://evil.example/login' }));
    external.toMicrosoft.and.returnValue(false);
    next().click();
    fixture.detectChanges();
    expect(el().querySelector('[data-error]')!.textContent).toContain('M365.ACCESS.START_ERROR');
    expect(fixture.componentInstance.busy()).toBeFalse();
  });

  it('shows why the client came back from Microsoft without finishing', () => {
    show({ resume: asset(), returnError: 'not_admin' });
    expect(el().querySelector('[data-return-error]')!.textContent).toContain('M365.RETURN.NOT_ADMIN');
  });

  it('back from an authorization it checks by itself, shows the real steps without a made-up percentage and ends with the mail guide', () => {
    const answer = new Subject<{ mode: string }>();
    api.validate.and.returnValue(answer as never);
    show({ resume: asset('t1') });
    expect(api.validate).toHaveBeenCalledOnceWith('a1');
    expect(el().querySelector('[data-row="ACCESS"]')!.getAttribute('data-row-state')).toBe('current');
    expect(el().textContent).not.toContain('%');
    expect(el().querySelector('[data-wizard-next]')).toBeNull();

    answer.next({ mode: 'live' });
    fixture.detectChanges();
    expect(el().querySelector('[data-result-title]')!.textContent).toContain('M365.RESULT.TITLE');
    const link = el().querySelector<HTMLAnchorElement>('[data-mail-link]')!;
    expect(link.href).toContain('https://entra.microsoft.com/');
    expect(link.rel).toContain('noopener');
  });

  it('retries on its own while Microsoft applies the permissions, and only then reports the failure with a way to try again', fakeAsync(() => {
    api.validate.and.returnValue(throwError(() => failed('consent', 'Falta aprobar')));
    show({ resume: asset('t1') });
    expect(el().querySelector('[data-waiting]')).not.toBeNull();
    for (let i = 1; i < CHECK_ATTEMPTS; i++) tick(CHECK_RETRY_MS);
    fixture.detectChanges();
    expect(api.validate).toHaveBeenCalledTimes(CHECK_ATTEMPTS);
    expect(el().querySelector('[data-message]')!.textContent).toContain('Falta aprobar');
    expect(next()).not.toBeNull();
  }));

  it('does not retry a failure the wait cannot fix', () => {
    api.validate.and.returnValue(throwError(() => failed('external_account_id', 'Otra organización')));
    show({ resume: asset('t1') });
    expect(api.validate).toHaveBeenCalledTimes(1);
    expect(el().querySelector('[data-message]')!.textContent).toContain('Otra organización');
  });

  it('leaving the screen cancels the pending retry', fakeAsync(() => {
    api.validate.and.returnValue(throwError(() => failed('consent', 'x')));
    show({ resume: asset('t1') });
    fixture.destroy();
    tick(CHECK_RETRY_MS * CHECK_ATTEMPTS);
    expect(api.validate).toHaveBeenCalledTimes(1);
  }));
});
