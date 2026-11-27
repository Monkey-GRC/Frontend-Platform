import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Asset } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { ExternalNavigation } from '@features/technical-control/domain/services/external-navigation.service';
import { MicrosoftReturnView } from './microsoft-return';

const ID = '2f1c3a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const asset = { id: ID, platform: 'microsoft_365', connection_category: 'ac_01', services: [{ id: 's1', name: 'S' }] } as unknown as Asset;

describe('MicrosoftReturnView', () => {
  let api: jasmine.SpyObj<TechnicalControlService>;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<MicrosoftReturnView>;

  function show(query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [MicrosoftReturnView],
      providers: [provideRouter([]), provideTranslateService(), { provide: TechnicalControlService, useValue: api }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(MicrosoftReturnView);
    fixture.detectChanges();
  }
  const wizard = ['/services', 's1', 'connections', 'new', 'ac_01', 'microsoft_365'];

  beforeEach(() => {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['completeMicrosoftConsent', 'getAsset']);
    api.completeMicrosoftConsent.and.returnValue(of(asset));
    api.getAsset.and.returnValue(of(asset));
  });

  it('finishes with the receipt and goes back to the wizard, leaving no receipt in the address or the history', () => {
    show({ m365: 'recibo', asset: ID });
    expect(api.completeMicrosoftConsent).toHaveBeenCalledOnceWith(ID, 'recibo');
    expect(navigate).toHaveBeenCalledOnceWith(wizard, { queryParams: { assetId: ID }, replaceUrl: true });
  });

  it('goes back with the reason when Microsoft did not authorize, without trying to finish', () => {
    show({ m365_error: 'not_admin', asset: ID });
    expect(api.completeMicrosoftConsent).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith(wizard, { queryParams: { assetId: ID, m365_error: 'not_admin' }, replaceUrl: true });
  });

  it('a receipt that is no longer valid goes back to authorize again', () => {
    api.completeMicrosoftConsent.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    show({ m365: 'viejo', asset: ID });
    expect(navigate).toHaveBeenCalledOnceWith(wizard, { queryParams: { assetId: ID, m365_error: 'expired' }, replaceUrl: true });
  });

  it('without a connection to return to, says so and offers Integrations', () => {
    show({ m365_error: 'expired' });
    expect(navigate).not.toHaveBeenCalled();
    expect(api.getAsset).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-back-to-integrations]')).not.toBeNull();
  });

  it('never calls the server with something that is not a connection id', () => {
    show({ m365: 'x', asset: '../../etc' });
    expect(api.completeMicrosoftConsent).not.toHaveBeenCalled();
  });
});

describe('ExternalNavigation', () => {
  it('only leaves the app towards the Microsoft sign-in', () => {
    const assign = jasmine.createSpy('assign');
    TestBed.configureTestingModule({ providers: [ExternalNavigation, { provide: DOCUMENT, useValue: { location: { assign }, querySelectorAll: () => [] } }] });
    const service = TestBed.inject(ExternalNavigation);
    for (const url of ['https://evil.example/', 'https://login.microsoftonline.com.evil.example/', 'http://login.microsoftonline.com/x', 'javascript:alert(1)']) expect(service.toMicrosoft(url)).toBeFalse();
    expect(assign).not.toHaveBeenCalled();
    expect(service.toMicrosoft('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?x=1')).toBeTrue();
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
